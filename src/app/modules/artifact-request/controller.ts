import type { Request, Response } from "express";
import { z } from "zod";
import { CandidateValidationError } from "../artifact-generation/CandidateValidator.js";
import { OpenRouterError } from "../llm/OpenRouterClient.js";
import {
    discardArtifactCandidate,
    editArtifactCandidate,
    getArtifactRequestDetails,
    selectArtifactCandidate,
} from "./ArtifactCandidateService.js";
import { artifactRequestCreateSchema } from "./schema.js";
import { createArtifactRequest } from "./service.js";

const requestIdSchema = z.object({ artifactRequestId: z.uuid() });
const candidateParamsSchema = z.object({ artifactRequestId: z.uuid(), candidateId: z.uuid() });
const editCandidateSchema = z.object({ content: z.string().trim().min(1).max(3000) });

function logFailure(req: Request, event: string, error: unknown, artifactRequestId?: string): void {
    console.error(JSON.stringify({
        event,
        requestId: String(resLocalsRequestId(req)),
        ...(artifactRequestId ? { artifactRequestId } : {}),
        errorName: error instanceof Error ? error.name : "UnknownError",
    }));
}

function resLocalsRequestId(req: Request): unknown {
    return req.res?.locals.requestId;
}

function sendCandidateActionResult(res: Response, result: Awaited<ReturnType<typeof selectArtifactCandidate>>): void {
    if (result.kind === "not-found") {
        res.status(404).json({ error: "ArtifactRequest or candidate not found" });
    } else if (result.kind === "conflict") {
        res.status(409).json({ error: result.message });
    } else if (result.kind === "updated") {
        res.status(200).json({ candidateId: result.candidateId, status: "updated" });
    } else {
        res.status(200).json({ artifact: result.artifact, candidateStatus: "SELECTED" });
    }
}

export async function createArtifactRequestController(req: Request, res: Response): Promise<void> {
    const parsed = artifactRequestCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid artifact request", details: parsed.error.issues });
        return;
    }

    try {
        const result = await createArtifactRequest(parsed.data);
        if (result.kind === "repository-not-found") {
            res.status(404).json({ error: "Repository not found" });
            return;
        }

        if (result.kind === "empty-scope") {
            res.status(422).json({ error: "No ChangeSets match the requested scope" });
            return;
        }

        if (result.kind === "clarification-required") {
            res.status(422).json({ error: "Clarification required", clarification: result.clarification });
            return;
        }

        res.status(202).json({
            id: result.request.id,
            repositoryId: result.request.repositoryId,
            artifactTypes: result.artifactTypes,
            scope: result.scope,
            instructions: result.request.instructions,
            targetChangeSetIds: result.targetChangeSetIds,
            supportingChangeSetIds: result.supportingChangeSetIds,
            status: result.request.status,
            createdAt: result.request.createdAt,
        });
    } catch (error) {
        if (error instanceof OpenRouterError) {
            res.status(error.status === 429 ? 503 : 502).json({ error: "Intent resolution is temporarily unavailable" });
            return;
        }
        logFailure(req, "artifact_request.create_failed", error);
        res.status(500).json({ error: "Failed to create ArtifactRequest" });
    }
}

export async function getArtifactRequestController(req: Request, res: Response): Promise<void> {
    const params = requestIdSchema.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: "Invalid ArtifactRequest ID" });
        return;
    }
    try {
        const details = await getArtifactRequestDetails(params.data.artifactRequestId);
        if (!details) {
            res.status(404).json({ error: "ArtifactRequest not found" });
            return;
        }
        res.status(200).json(details);
    } catch (error) {
        logFailure(req, "artifact_request.load_failed", error, params.data.artifactRequestId);
        res.status(500).json({ error: "Failed to load ArtifactRequest" });
    }
}

export async function editArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = candidateParamsSchema.safeParse(req.params);
    const body = editCandidateSchema.safeParse(req.body);
    if (!params.success || !body.success) {
        res.status(400).json({ error: "Invalid candidate edit request" });
        return;
    }
    try {
        sendCandidateActionResult(res, await editArtifactCandidate({ ...params.data, content: body.data.content }));
    } catch (error) {
        if (error instanceof CandidateValidationError) {
            res.status(422).json({ error: "Edited candidate did not pass evidence and safety validation" });
            return;
        }
        if (error instanceof OpenRouterError) {
            res.status(error.status === 429 ? 503 : 502).json({ error: "Candidate validation is temporarily unavailable" });
            return;
        }
        logFailure(req, "artifact_candidate.edit_failed", error, params.data.artifactRequestId);
        res.status(500).json({ error: "Failed to edit candidate" });
    }
}

export async function selectArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = candidateParamsSchema.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: "Invalid candidate selection request" });
        return;
    }
    try {
        sendCandidateActionResult(res, await selectArtifactCandidate(params.data));
    } catch (error) {
        logFailure(req, "artifact_candidate.select_failed", error, params.data.artifactRequestId);
        res.status(500).json({ error: "Failed to select candidate" });
    }
}

export async function discardArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = candidateParamsSchema.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: "Invalid candidate discard request" });
        return;
    }
    try {
        sendCandidateActionResult(res, await discardArtifactCandidate(params.data));
    } catch (error) {
        logFailure(req, "artifact_candidate.discard_failed", error, params.data.artifactRequestId);
        res.status(500).json({ error: "Failed to discard candidate" });
    }
}

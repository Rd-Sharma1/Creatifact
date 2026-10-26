import type { Request, Response } from "express";
import { ConflictError, DomainValidationError, NotFoundError } from "../../common/errors.js";
import { parseOrThrow } from "../../common/validation.js";
import {
    artifactCandidateIdParamsSchema,
    artifactRequestCreateSchema,
    artifactRequestParamsSchema,
    editArtifactCandidateBodySchema,
    type ArtifactRequestCreateInput,
} from "./schema.js";
import {
    discardArtifactCandidate,
    editArtifactCandidate,
    getArtifactRequestDetails,
    selectArtifactCandidate,
} from "./ArtifactCandidateService.js";
import { createArtifactRequest } from "./service.js";

function validatedArtifactRequestId(req: Request, res: Response): string {
    const authorizedId = res.locals.artifactRequestId;
    if (typeof authorizedId === "string") return authorizedId;
    return parseOrThrow(artifactRequestParamsSchema, req.params).artifactRequestId;
}

function validatedCandidateParams(req: Request, res: Response): { artifactRequestId: string; candidateId: string } {
    return {
        artifactRequestId: validatedArtifactRequestId(req, res),
        candidateId: parseOrThrow(artifactCandidateIdParamsSchema, req.params).candidateId,
    };
}

function sendCandidateActionResult(res: Response, result: Awaited<ReturnType<typeof selectArtifactCandidate>>): void {
    if (result.kind === "not-found") throw new NotFoundError("ArtifactRequest or candidate not found");
    if (result.kind === "conflict") throw new ConflictError(result.message);
    if (result.kind === "updated") {
        res.status(200).json({ candidateId: result.candidateId, status: "updated" });
        return;
    }
    res.status(200).json({ artifact: result.artifact, candidateStatus: "SELECTED" });
}

export async function createArtifactRequestController(req: Request, res: Response): Promise<void> {
    const input = (res.locals.artifactRequestInput as ArtifactRequestCreateInput | undefined)
        ?? parseOrThrow(artifactRequestCreateSchema, req.body);
    const result = await createArtifactRequest(input, { correlationId: res.locals.requestId });
    if (result.kind === "repository-not-found") throw new NotFoundError("Repository not found");
    if (result.kind === "empty-scope") {
        throw new DomainValidationError("EMPTY_SCOPE", "No ChangeSets match the requested scope");
    }
    if (result.kind === "clarification-required") {
        throw new DomainValidationError("CLARIFICATION_REQUIRED", "Clarification is required to resolve this request");
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
}

export async function getArtifactRequestController(req: Request, res: Response): Promise<void> {
    const artifactRequestId = validatedArtifactRequestId(req, res);
    const details = await getArtifactRequestDetails(artifactRequestId);
    if (!details) throw new NotFoundError("ArtifactRequest not found");
    res.status(200).json(details);
}

export async function editArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = validatedCandidateParams(req, res);
    const body = parseOrThrow(editArtifactCandidateBodySchema, req.body);
    sendCandidateActionResult(res, await editArtifactCandidate({ ...params, content: body.content }));
}

export async function selectArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = validatedCandidateParams(req, res);
    sendCandidateActionResult(res, await selectArtifactCandidate(params));
}

export async function discardArtifactCandidateController(req: Request, res: Response): Promise<void> {
    const params = validatedCandidateParams(req, res);
    sendCandidateActionResult(res, await discardArtifactCandidate(params));
}

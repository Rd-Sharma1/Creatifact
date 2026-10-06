import type { Request, Response } from "express";
import { artifactRequestCreateSchema } from "./schema.js";
import { createArtifactRequest } from "./service.js";

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

        res.status(201).json({
            id: result.request.id,
            repositoryId: result.request.repositoryId,
            artifactTypes: result.artifactTypes,
            scope: result.scope,
            instructions: result.request.instructions,
            changeSetIds: result.changeSetIds,
            status: result.request.status,
            createdAt: result.request.createdAt,
        });
    } catch (error) {
        console.error("Failed to create ArtifactRequest", error);
        res.status(500).json({ error: "Failed to create ArtifactRequest" });
    }
}

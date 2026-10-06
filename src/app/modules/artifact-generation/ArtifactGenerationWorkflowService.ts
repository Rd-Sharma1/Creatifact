import type { ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactType } from "../../../domain/types.js";
import { artifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import { artifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import type { ArtifactGenerationService } from "./ArtifactGenerationService.js";
import { artifactGenerationService } from "./ArtifactGenerationService.js";

export type ArtifactGenerationOutcome = {
    type: ArtifactType;
    artifactId: string;
    disposition: "created" | "existing";
};

export class ArtifactTypesGenerationFailedError extends Error {
    constructor(readonly failedTypes: ArtifactType[]) {
        super(`Artifact generation failed for: ${failedTypes.join(", ")}`);
        this.name = "ArtifactTypesGenerationFailedError";
    }
}

export class ArtifactGenerationWorkflowService {
    constructor(
        private readonly contextService: Pick<ArtifactGenerationContextService, "build"> = artifactGenerationContextService,
        private readonly generationService: Pick<ArtifactGenerationService, "generateType"> = artifactGenerationService,
        private readonly persistence: ArtifactGenerationPersistence = artifactGenerationPersistence,
    ) {}

    markFailed(artifactRequestId: string): Promise<void> {
        return this.persistence.markFailed(artifactRequestId);
    }

    async run(artifactRequestId: string): Promise<ArtifactGenerationOutcome[]> {
        const status = await this.persistence.markGenerating(artifactRequestId);
        if (status === "COMPLETED") {
            return [];
        }
        if (status !== "GENERATING") {
            throw new Error(`ArtifactRequest ${artifactRequestId} cannot generate from status ${status}`);
        }

        const context = await this.contextService.build(artifactRequestId);
        const outcomes: ArtifactGenerationOutcome[] = [];
        const failedTypes: ArtifactType[] = [];

        for (const type of context.requestedArtifactTypes) {
            try {
                const existing = await this.persistence.findArtifact(artifactRequestId, type);
                if (existing) {
                    outcomes.push({ type, artifactId: existing.id, disposition: "existing" });
                    continue;
                }

                const generated = await this.generationService.generateType(context, type);
                const persisted = await this.persistence.persistIfAbsent(artifactRequestId, generated);
                outcomes.push({
                    type,
                    artifactId: persisted.artifact.id,
                    disposition: persisted.created ? "created" : "existing",
                });
            } catch {
                failedTypes.push(type);
            }
        }

        if (failedTypes.length > 0) {
            throw new ArtifactTypesGenerationFailedError(failedTypes);
        }

        await this.persistence.markCompleted(artifactRequestId);
        return outcomes;
    }
}

export const artifactGenerationWorkflowService = new ArtifactGenerationWorkflowService();

import type { ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactCandidate, ArtifactType } from "../../../domain/types.js";
import { artifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import { artifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import type { ArtifactGenerationService } from "./ArtifactGenerationService.js";
import { artifactGenerationService } from "./ArtifactGenerationService.js";
import { ApplicationError, ConflictError } from "../../common/errors.js";

export type ArtifactGenerationOutcome = { type: ArtifactType; candidates: ArtifactCandidate[] };

export class ArtifactTypesGenerationFailedError extends Error {
    constructor(readonly failedTypes: ArtifactType[]) {
        super("Candidate generation failed for one or more requested artifact types");
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
        if (status === "COMPLETED") return [];
        if (status !== "GENERATING") throw new ConflictError("ArtifactRequest cannot generate from its current state");
        console.info(JSON.stringify({ event: "artifact_generation.started", artifactRequestId }));

        const context = await this.contextService.build(artifactRequestId);
        const outcomes: ArtifactGenerationOutcome[] = [];
        const failedTypes: ArtifactType[] = [];

        for (const type of context.requestedArtifactTypes) {
            try {
                const existing = await this.persistence.findCandidates(artifactRequestId, type);
                if (existing.length > 0) {
                    outcomes.push({ type, candidates: existing });
                    console.info(JSON.stringify({ event: "artifact_generation.type_skipped", artifactRequestId, type, candidateCount: existing.length }));
                    continue;
                }

                const generated = await this.generationService.generateType(context, type);
                const candidates = await this.persistence.persistCandidatesIfAbsent(artifactRequestId, generated);
                outcomes.push({ type, candidates });
                console.info(JSON.stringify({ event: "artifact_generation.type_completed", artifactRequestId, type, candidateCount: candidates.length }));
            } catch (error) {
                failedTypes.push(type);
                console.error(JSON.stringify({
                    event: "artifact_generation.type_failed",
                    artifactRequestId,
                    type,
                    errorName: error instanceof Error ? error.name : "UnknownError",
                    ...(error instanceof ApplicationError ? { errorCode: error.code } : {}),
                    ...(error instanceof Error && error.cause instanceof Error ? { causeName: error.cause.name } : {}),
                }));
            }
        }

        if (failedTypes.length > 0) throw new ArtifactTypesGenerationFailedError(failedTypes);
        await this.persistence.markCompleted(artifactRequestId);
        console.info(JSON.stringify({ event: "artifact_generation.completed", artifactRequestId }));
        return outcomes;
    }
}

export const artifactGenerationWorkflowService = new ArtifactGenerationWorkflowService();

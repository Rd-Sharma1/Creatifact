import type { ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactCandidate, ArtifactGenerationTrace, ArtifactType } from "../../../domain/types.js";
import { artifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import type { ArtifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import { artifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import type { ArtifactGenerationService } from "./ArtifactGenerationService.js";
import { artifactGenerationService } from "./ArtifactGenerationService.js";
import { ApplicationError, ConflictError } from "../../common/errors.js";
import { writeLog } from "../../common/logger.js";

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

    async run(
        artifactRequestId: string,
        correlationId?: string,
        workflowRunId?: string,
        retryAttempt?: number,
    ): Promise<ArtifactGenerationOutcome[]> {
        let status: Awaited<ReturnType<ArtifactGenerationPersistence["markGenerating"]>>;
        try {
            status = await this.persistence.markGenerating(artifactRequestId);
        } catch (error) {
            this.logWorkflowFailure(artifactRequestId, "status_transition", error, correlationId, workflowRunId, retryAttempt);
            throw error;
        }
        if (status === "COMPLETED") return [];
        if (status !== "GENERATING") throw new ConflictError("ArtifactRequest cannot generate from its current state");
        const trace: ArtifactGenerationTrace = {
            artifactRequestId,
            ...(correlationId ? { correlationId } : { correlationId: artifactRequestId }),
            ...(workflowRunId ? { workflowRunId } : {}),
            ...(retryAttempt !== undefined ? { retryAttempt } : {}),
        };
        writeLog("info", "artifact_generation.started", trace);

        let context: Awaited<ReturnType<ArtifactGenerationContextService["build"]>>;
        try {
            context = await this.contextService.build(artifactRequestId);
        } catch (error) {
            this.logWorkflowFailure(artifactRequestId, "context_build", error, trace.correlationId, workflowRunId, retryAttempt);
            throw error;
        }
        const outcomes: ArtifactGenerationOutcome[] = [];
        const failedTypes: ArtifactType[] = [];

        for (const type of context.requestedArtifactTypes) {
            let stage = "candidate_lookup";
            try {
                const existing = await this.persistence.findCandidates(artifactRequestId, type);
                if (existing.length > 0) {
                    outcomes.push({ type, candidates: existing });
                    writeLog("info", "artifact_generation.type_skipped", { ...trace, type, candidateCount: existing.length });
                    continue;
                }

                stage = "generation_and_evaluation";
                const generated = await this.generationService.generateType(context, type, trace);
                stage = "candidate_persistence";
                const candidates = await this.persistence.persistCandidatesIfAbsent(artifactRequestId, generated);
                outcomes.push({ type, candidates });
                writeLog("info", "artifact_generation.type_completed", { ...trace, type, candidateCount: candidates.length });
            } catch (error) {
                failedTypes.push(type);
                writeLog("error", "artifact_generation.type_failed", {
                    ...trace,
                    type,
                    stage,
                    errorName: error instanceof Error ? error.name : "UnknownError",
                    ...(error instanceof ApplicationError ? { errorCode: error.code } : {}),
                    ...(error instanceof Error && error.cause instanceof Error ? { causeName: error.cause.name } : {}),
                });
            }
        }

        if (failedTypes.length > 0) throw new ArtifactTypesGenerationFailedError(failedTypes);
        try {
            await this.persistence.markCompleted(artifactRequestId);
        } catch (error) {
            this.logWorkflowFailure(artifactRequestId, "status_completion", error, trace.correlationId, workflowRunId, retryAttempt);
            throw error;
        }
        writeLog("info", "artifact_generation.completed", trace);
        return outcomes;
    }

    private logWorkflowFailure(
        artifactRequestId: string,
        stage: string,
        error: unknown,
        correlationId?: string,
        workflowRunId?: string,
        retryAttempt?: number,
    ): void {
        writeLog("error", "artifact_generation.workflow_failed", {
            artifactRequestId,
            correlationId,
            workflowRunId,
            retryAttempt,
            stage,
            errorName: error instanceof Error ? error.name : "UnknownError",
            ...(error instanceof ApplicationError ? { errorCode: error.code } : {}),
            ...(error instanceof Error && error.cause instanceof Error ? { causeName: error.cause.name } : {}),
        });
    }
}

export const artifactGenerationWorkflowService = new ArtifactGenerationWorkflowService();

import { db } from "../../../db/index.js";
import { aiRunTable } from "../../../db/schema.js";
import { writeLog } from "../../common/logger.js";

export type AiOperation = "scope_interpretation" | "generation" | "evaluation" | "candidate_validation";
export type AiRunOutcome = "SUCCEEDED" | "FAILED" | "REJECTED";
export type AiFailureCategory = "CONFIGURATION" | "UPSTREAM" | "OUTPUT_SCHEMA" | "VALIDATION" | "UNKNOWN";

export type AiRunRecord = {
    correlationId?: string | undefined;
    artifactRequestId?: string | undefined;
    workflowRunId?: string | undefined;
    operation: AiOperation;
    model: string | null;
    promptVersion: string;
    startedAt: Date;
    durationMs: number;
    outcome: AiRunOutcome;
    failureCategory?: AiFailureCategory | undefined;
    retryAttempt?: number | undefined;
    validationFailureCodes?: string[] | undefined;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
    cost?: number | undefined;
};

export interface AiRunRecorder {
    record(run: AiRunRecord): Promise<void>;
}

export class AiRunTelemetry implements AiRunRecorder {
    constructor(private readonly insert: (run: AiRunRecord) => Promise<void> = async run => {
        await db.insert(aiRunTable).values({
            correlationId: run.correlationId ?? null,
            artifactRequestId: run.artifactRequestId ?? null,
            workflowRunId: run.workflowRunId ?? null,
            operation: run.operation,
            model: run.model,
            promptVersion: run.promptVersion,
            startedAt: run.startedAt,
            durationMs: run.durationMs,
            outcome: run.outcome,
            failureCategory: run.failureCategory ?? null,
            retryAttempt: run.retryAttempt ?? null,
            validationFailureCodes: run.validationFailureCodes ?? [],
            inputTokens: run.inputTokens ?? null,
            outputTokens: run.outputTokens ?? null,
            totalTokens: run.totalTokens ?? null,
            cost: run.cost ?? null,
        });
    }) {}

    async record(run: AiRunRecord): Promise<void> {
        try {
            await this.insert(run);
        } catch (error) {
            writeLog("error", "ai_run.telemetry_write_failed", {
                correlationId: run.correlationId,
                artifactRequestId: run.artifactRequestId,
                operation: run.operation,
                errorName: error instanceof Error ? error.name : "UnknownError",
            });
        }
    }
}

export const aiRunTelemetry = new AiRunTelemetry();

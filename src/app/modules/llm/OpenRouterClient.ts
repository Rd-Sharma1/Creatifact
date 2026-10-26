import "dotenv/config";
import { z } from "zod";
import { ConfigurationError, UpstreamProviderError } from "../../common/errors.js";
import { writeLog } from "../../common/logger.js";
import { aiRunTelemetry, type AiFailureCategory, type AiOperation, type AiRunRecorder } from "./AiRunTelemetry.js";

const completionResponseSchema = z.object({
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    usage: z.object({
        prompt_tokens: z.number().int().nonnegative().optional(),
        completion_tokens: z.number().int().nonnegative().optional(),
        total_tokens: z.number().int().nonnegative().optional(),
        cost: z.number().nonnegative().optional(),
    }).optional(),
});

export class OpenRouterError extends UpstreamProviderError {
    constructor(_reason: string, status?: number, options?: ErrorOptions) {
        super("OpenRouter", status, options);
    }
}

export type OpenRouterTask = "scope" | "generation";

export class OpenRouterClient {
    constructor(
        private readonly apiKey = process.env.OPENROUTER_API_KEY,
        private readonly fetcher: typeof fetch = fetch,
        private readonly timeoutMs = 45_000,
        private readonly telemetry: AiRunRecorder = aiRunTelemetry,
    ) {}

    async completeJson<T>(input: {
        task: OpenRouterTask;
        system: string;
        user: string;
        maxOutputTokens: number;
        schema: z.ZodType<T>;
        telemetry?: {
            correlationId?: string;
            artifactRequestId?: string;
            workflowRunId?: string;
            operation?: AiOperation;
            promptVersion?: string;
            retryAttempt?: number;
            validationFailureCodes?: (output: T) => string[];
        };
    }): Promise<T> {
        const startedAt = new Date();
        const started = performance.now();
        const model = input.task === "scope"
            ? process.env.OPENROUTER_SCOPE_MODEL
            : process.env.OPENROUTER_GENERATION_MODEL;
        const operation = input.telemetry?.operation ?? (input.task === "scope" ? "scope_interpretation" : "generation");
        let failureCategory: AiFailureCategory = "UNKNOWN";
        let usage: z.infer<typeof completionResponseSchema>["usage"] = undefined;
        let outcome: "SUCCEEDED" | "FAILED" | "REJECTED" = "FAILED";
        let validationFailureCodes: string[] = [];
        try {
            if (!this.apiKey) {
                failureCategory = "CONFIGURATION";
                throw new ConfigurationError({ variables: ["OPENROUTER_API_KEY"] });
            }
            if (!model) {
                failureCategory = "CONFIGURATION";
                throw new ConfigurationError({ variables: [`OPENROUTER_${input.task.toUpperCase()}_MODEL`] });
            }

            failureCategory = "UPSTREAM";
            let response: Response;
            try {
                response = await this.fetcher("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        authorization: `Bearer ${this.apiKey}`,
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: "system", content: input.system },
                            { role: "user", content: input.user },
                        ],
                        max_tokens: input.maxOutputTokens,
                        temperature: 0.2,
                        response_format: { type: "json_object" },
                        provider: { data_collection: "deny", zdr: true },
                        stream: false,
                    }),
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
            } catch (error) {
                throw new OpenRouterError("OpenRouter request failed or timed out", undefined, { cause: error });
            }

            if (!response.ok) throw new OpenRouterError(`OpenRouter returned HTTP ${response.status}`, response.status);

            failureCategory = "OUTPUT_SCHEMA";
            let responseJson: unknown;
            try {
                responseJson = await response.json();
            } catch (error) {
                throw new OpenRouterError("OpenRouter returned invalid JSON", response.status, { cause: error });
            }

            const parsedResponse = completionResponseSchema.safeParse(responseJson);
            if (!parsedResponse.success) throw new OpenRouterError("Invalid completion response", response.status);
            usage = parsedResponse.data.usage;
            const content = parsedResponse.data.choices[0]?.message.content;
            if (!content) throw new OpenRouterError("Empty completion", response.status);

            let output: unknown;
            try {
                output = JSON.parse(content);
            } catch (error) {
                throw new OpenRouterError("Malformed structured output", response.status, { cause: error });
            }

            const validated = input.schema.safeParse(output);
            if (!validated.success) throw new OpenRouterError("Structured output validation failed", response.status);
            validationFailureCodes = input.telemetry?.validationFailureCodes?.(validated.data) ?? [];
            outcome = validationFailureCodes.length > 0 ? "REJECTED" : "SUCCEEDED";
            if (outcome === "REJECTED") failureCategory = "VALIDATION";
            else failureCategory = "UNKNOWN";
            return validated.data;
        } catch (error) {
            await this.recordTelemetry({
                correlationId: input.telemetry?.correlationId,
                artifactRequestId: input.telemetry?.artifactRequestId,
                workflowRunId: input.telemetry?.workflowRunId,
                operation,
                model: model ?? null,
                promptVersion: input.telemetry?.promptVersion ?? `${input.task}.unversioned`,
                startedAt,
                durationMs: Math.round(performance.now() - started),
                outcome,
                failureCategory,
                retryAttempt: input.telemetry?.retryAttempt,
                validationFailureCodes,
                inputTokens: usage?.prompt_tokens,
                outputTokens: usage?.completion_tokens,
                totalTokens: usage?.total_tokens,
                cost: usage?.cost,
            });
            throw error;
        } finally {
            if (outcome !== "FAILED") {
                await this.recordTelemetry({
                    correlationId: input.telemetry?.correlationId,
                    artifactRequestId: input.telemetry?.artifactRequestId,
                    workflowRunId: input.telemetry?.workflowRunId,
                    operation,
                    model: model ?? null,
                    promptVersion: input.telemetry?.promptVersion ?? `${input.task}.unversioned`,
                    startedAt,
                    durationMs: Math.round(performance.now() - started),
                    outcome,
                    ...(outcome === "REJECTED" ? { failureCategory: "VALIDATION" as const } : {}),
                    retryAttempt: input.telemetry?.retryAttempt,
                    validationFailureCodes,
                    inputTokens: usage?.prompt_tokens,
                    outputTokens: usage?.completion_tokens,
                    totalTokens: usage?.total_tokens,
                    cost: usage?.cost,
                });
            }
        }
    }

    private async recordTelemetry(run: Parameters<AiRunRecorder["record"]>[0]): Promise<void> {
        writeLog(run.outcome === "FAILED" ? "error" : run.outcome === "REJECTED" ? "warn" : "info", "ai.run.finished", {
            correlationId: run.correlationId,
            artifactRequestId: run.artifactRequestId,
            workflowRunId: run.workflowRunId,
            operation: run.operation,
            model: run.model,
            promptVersion: run.promptVersion,
            durationMs: run.durationMs,
            outcome: run.outcome,
            failureCategory: run.failureCategory,
            retryAttempt: run.retryAttempt,
            validationFailureCodes: run.validationFailureCodes?.join(","),
            inputTokens: run.inputTokens,
            outputTokens: run.outputTokens,
            totalTokens: run.totalTokens,
            cost: run.cost,
        });
        try {
            await this.telemetry.record(run);
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

export const openRouterClient = new OpenRouterClient();

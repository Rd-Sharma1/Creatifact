import "dotenv/config";
import { z } from "zod";
import { ConfigurationError, UpstreamProviderError } from "../../common/errors.js";
import { writeLog } from "../../common/logger.js";
import { aiRunTelemetry, type AiFailureCategory, type AiOperation, type AiRunRecorder } from "./AiRunTelemetry.js";

const completionResponseSchema = z
    .object({
        choices: z
            .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
            .min(1)
            .optional(),
        candidates: z
            .array(
                z.object({
                    content: z
                        .object({
                            parts: z.array(z.object({ text: z.string().nullable().optional() })).min(1),
                        })
                        .optional(),
                }),
            )
            .min(1)
            .optional(),
        usage: z
            .object({
                prompt_tokens: z.number().int().nonnegative().optional(),
                completion_tokens: z.number().int().nonnegative().optional(),
                total_tokens: z.number().int().nonnegative().optional(),
                cost: z.number().nonnegative().optional(),
            })
            .optional(),
        usageMetadata: z
            .object({
                promptTokenCount: z.number().int().nonnegative().optional(),
                candidatesTokenCount: z.number().int().nonnegative().optional(),
                totalTokenCount: z.number().int().nonnegative().optional(),
            })
            .optional(),
    })
    .passthrough();

export type OpenRouterDiagnosticCode = "HTTP_ERROR" | "REQUEST_TIMEOUT" | "REQUEST_FAILED" | "OUTPUT_PARSING_ERROR";

export class OpenRouterError extends UpstreamProviderError {
    constructor(
        readonly diagnosticCode: OpenRouterDiagnosticCode,
        status?: number,
        options?: ErrorOptions,
    ) {
        super("Gemini", status, options);
    }
}

export type OpenRouterTask = "scope" | "generation";

function firstConfiguredEnv(...keys: string[]): string | undefined {
    for (const key of keys) {
        const value = process.env[key];
        if (value && value.trim()) return value;
    }
    return undefined;
}

export class OpenRouterClient {
    constructor(
        private readonly apiKey = firstConfiguredEnv("GEMINI_API_KEY", "LLM_API_KEY", "OPENROUTER_API_KEY"),
        private readonly fetcher: typeof fetch = fetch,
        private readonly timeoutMs = 45_000,
        private readonly telemetry: AiRunRecorder = aiRunTelemetry,
    ) {}

    private getModel(task: OpenRouterTask): string | undefined {
        const model =
            task === "scope"
                ? firstConfiguredEnv("GEMINI_SCOPE_MODEL", "LLM_SCOPE_MODEL", "OPENROUTER_SCOPE_MODEL")
                : firstConfiguredEnv("GEMINI_GENERATION_MODEL", "LLM_GENERATION_MODEL", "OPENROUTER_GENERATION_MODEL");
        return model ?? (task === "scope" ? "gemini-2.0-flash" : "gemini-2.0-flash");
    }

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
        const model = this.getModel(input.task);
        const operation =
            input.telemetry?.operation ?? (input.task === "scope" ? "scope_interpretation" : "generation");
        let failureCategory: AiFailureCategory = "UNKNOWN";
        let usage:
            | {
                  prompt_tokens?: number | undefined;
                  completion_tokens?: number | undefined;
                  total_tokens?: number | undefined;
                  cost?: number | undefined;
              }
            | undefined;
        let outcome: "SUCCEEDED" | "FAILED" | "REJECTED" = "FAILED";
        let validationFailureCodes: string[] = [];
        try {
            if (!this.apiKey) {
                failureCategory = "CONFIGURATION";
                throw new ConfigurationError({ variables: ["GEMINI_API_KEY", "LLM_API_KEY", "OPENROUTER_API_KEY"] });
            }
            if (!model) {
                failureCategory = "CONFIGURATION";
                throw new ConfigurationError({
                    variables: [
                        "GEMINI_GENERATION_MODEL",
                        "GEMINI_SCOPE_MODEL",
                        "LLM_GENERATION_MODEL",
                        "LLM_SCOPE_MODEL",
                        "OPENROUTER_GENERATION_MODEL",
                        "OPENROUTER_SCOPE_MODEL",
                    ],
                });
            }

            failureCategory = "UPSTREAM";
            let response: Response;
            try {
                const payload = {
                    contents: [{ role: "user", parts: [{ text: input.user }] }],
                    ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
                    generationConfig: {
                        maxOutputTokens: input.maxOutputTokens,
                        responseMimeType: "application/json",
                    },
                };
                const url = new URL(
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
                );
                url.searchParams.set("key", this.apiKey);
                response = await this.fetcher(url, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
            } catch (error) {
                const diagnosticCode =
                    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
                        ? "REQUEST_TIMEOUT"
                        : "REQUEST_FAILED";
                throw new OpenRouterError(diagnosticCode, undefined, { cause: error });
            }

            if (!response.ok) throw new OpenRouterError("HTTP_ERROR", response.status);

            failureCategory = "OUTPUT_SCHEMA";
            let responseJson: unknown;
            try {
                responseJson = await response.json();
            } catch (error) {
                throw new OpenRouterError("OUTPUT_PARSING_ERROR", response.status, { cause: error });
            }

            const parsedResponse = completionResponseSchema.safeParse(responseJson);
            if (!parsedResponse.success) throw new OpenRouterError("OUTPUT_PARSING_ERROR", response.status);
            const rawUsage: typeof usage = parsedResponse.data.usage ?? {
                prompt_tokens: parsedResponse.data.usageMetadata?.promptTokenCount,
                completion_tokens: parsedResponse.data.usageMetadata?.candidatesTokenCount,
                total_tokens: parsedResponse.data.usageMetadata?.totalTokenCount,
            };
            usage = rawUsage;

            const candidates =
                parsedResponse.data.candidates ??
                parsedResponse.data.choices?.map(choice => ({
                    content: {
                        parts: [{ text: choice.message.content }],
                    },
                })) ??
                [];
            const content = candidates[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? null;
            if (!content) throw new OpenRouterError("OUTPUT_PARSING_ERROR", response.status);

            let output: unknown;
            try {
                output = JSON.parse(content);
            } catch (error) {
                throw new OpenRouterError("OUTPUT_PARSING_ERROR", response.status, { cause: error });
            }

            const validated = input.schema.safeParse(output);
            if (!validated.success) throw new OpenRouterError("OUTPUT_PARSING_ERROR", response.status);
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

import "dotenv/config";
import { z } from "zod";

const completionResponseSchema = z.object({
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

export class OpenRouterError extends Error {
    constructor(message: string, readonly status?: number, options?: ErrorOptions) {
        super(message, options);
        this.name = "OpenRouterError";
    }
}

export type OpenRouterTask = "scope" | "generation";

export class OpenRouterClient {
    constructor(
        private readonly apiKey = process.env.OPENROUTER_API_KEY,
        private readonly fetcher: typeof fetch = fetch,
        private readonly timeoutMs = 45_000,
    ) {}

    async completeJson<T>(input: {
        task: OpenRouterTask;
        system: string;
        user: string;
        maxOutputTokens: number;
        schema: z.ZodType<T>;
    }): Promise<T> {
        if (!this.apiKey) {
            throw new OpenRouterError("OPENROUTER_API_KEY is not configured");
        }

        const model = input.task === "scope"
            ? process.env.OPENROUTER_SCOPE_MODEL
            : process.env.OPENROUTER_GENERATION_MODEL;
        if (!model) {
            throw new OpenRouterError(`OPENROUTER_${input.task.toUpperCase()}_MODEL is not configured`);
        }

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

        if (!response.ok) {
            throw new OpenRouterError(`OpenRouter returned HTTP ${response.status}`, response.status);
        }

        let responseJson: unknown;
        try {
            responseJson = await response.json();
        } catch (error) {
            throw new OpenRouterError("OpenRouter returned invalid JSON", response.status, { cause: error });
        }

        const parsedResponse = completionResponseSchema.safeParse(responseJson);
        if (!parsedResponse.success) {
            throw new OpenRouterError("OpenRouter response did not contain a completion", response.status);
        }

        const content = parsedResponse.data.choices[0]?.message.content;
        if (!content) {
            throw new OpenRouterError("OpenRouter returned an empty completion", response.status);
        }

        let output: unknown;
        try {
            output = JSON.parse(content);
        } catch (error) {
            throw new OpenRouterError("OpenRouter returned malformed structured output", response.status, { cause: error });
        }

        const validated = input.schema.safeParse(output);
        if (!validated.success) {
            throw new OpenRouterError("OpenRouter output failed application schema validation", response.status);
        }
        return validated.data;
    }
}

export const openRouterClient = new OpenRouterClient();

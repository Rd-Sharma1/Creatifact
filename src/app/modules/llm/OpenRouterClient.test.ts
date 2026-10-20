import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { OpenRouterClient, OpenRouterError } from "./OpenRouterClient.js";

const outputSchema = z.object({ value: z.string() });

describe("OpenRouterClient", () => {
    it("uses configured models, denies provider data collection, and validates JSON output", async () => {
        const previousModel = process.env.OPENROUTER_GENERATION_MODEL;
        process.env.OPENROUTER_GENERATION_MODEL = "test/model";
        let requestBody: Record<string, unknown> | undefined;
        const fakeFetch: typeof fetch = async (_input, init) => {
            requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ value: "ok" }) } }] }), { status: 200 });
        };
        try {
            const result = await new OpenRouterClient("test-key", fakeFetch).completeJson({
                task: "generation", system: "system", user: "user", maxOutputTokens: 100, schema: outputSchema,
            });
            assert.deepEqual(result, { value: "ok" });
            assert.deepEqual(requestBody?.provider, { data_collection: "deny", zdr: true });
            assert.equal(requestBody?.model, "test/model");
        } finally {
            if (previousModel === undefined) delete process.env.OPENROUTER_GENERATION_MODEL;
            else process.env.OPENROUTER_GENERATION_MODEL = previousModel;
        }
    });

    it("surfaces provider status without exposing response body or key", async () => {
        const fakeFetch: typeof fetch = async () => new Response("private provider body", { status: 429 });
        const client = new OpenRouterClient("secret-test-key", fakeFetch);
        await assert.rejects(
            client.completeJson({ task: "scope", system: "s", user: "u", maxOutputTokens: 50, schema: outputSchema }),
            error => error instanceof OpenRouterError && error.status === 429 && !error.message.includes("secret-test-key"),
        );
    });
});

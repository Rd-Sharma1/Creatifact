import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { OpenRouterClient, OpenRouterError } from "./OpenRouterClient.js";

const outputSchema = z.object({ value: z.string() });
const noTelemetry = { record: async () => {} };

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
            const result = await new OpenRouterClient("test-key", fakeFetch, 1000, noTelemetry).completeJson({
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
        const records: import("./AiRunTelemetry.js").AiRunRecord[] = [];
        const client = new OpenRouterClient("secret-test-key", fakeFetch, 1000, { record: async record => { records.push(record); } });
        await assert.rejects(
            client.completeJson({ task: "scope", system: "s", user: "u", maxOutputTokens: 50, schema: outputSchema }),
            error => error instanceof OpenRouterError && error.providerStatus === 429 && error.status === 503 && !error.message.includes("secret-test-key"),
        );
        assert.equal(records[0]?.outcome, "FAILED");
        assert.equal(records[0]?.failureCategory, "UPSTREAM");
    });

    it("records safe generation metadata and provider usage without prompt or response content", async () => {
        const previousModel = process.env.OPENROUTER_GENERATION_MODEL;
        process.env.OPENROUTER_GENERATION_MODEL = "test/model";
        const records: import("./AiRunTelemetry.js").AiRunRecord[] = [];
        const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ value: "generated secret-looking content" }) } }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, cost: 0.001 },
        }), { status: 200 });
        try {
            const client = new OpenRouterClient("test-key", fakeFetch, 1000, { record: async record => { records.push(record); } });
            await client.completeJson({
                task: "generation", system: "private prompt", user: "private patch", maxOutputTokens: 100, schema: outputSchema,
                telemetry: {
                    correlationId: "d01ae1f4-e3e2-413b-a765-13f4756b1385",
                    artifactRequestId: "b4687374-d4d8-4df1-b795-71d7cf34a550",
                    operation: "generation",
                    promptVersion: "candidate-generation.v1",
                    workflowRunId: "inngest-run-abc",
                    retryAttempt: 1,
                },
            });
            assert.equal(records.length, 1);
            assert.equal(records[0]?.outcome, "SUCCEEDED");
            assert.equal(records[0]?.inputTokens, 12);
            assert.equal(records[0]?.outputTokens, 8);
            assert.equal(records[0]?.totalTokens, 20);
            assert.equal(records[0]?.cost, 0.001);
            assert.equal(records[0]?.workflowRunId, "inngest-run-abc");
            assert.equal(records[0]?.retryAttempt, 1);
            assert.equal(JSON.stringify(records[0]).includes("private patch"), false);
            assert.equal(JSON.stringify(records[0]).includes("generated secret-looking content"), false);
        } finally {
            if (previousModel === undefined) delete process.env.OPENROUTER_GENERATION_MODEL;
            else process.env.OPENROUTER_GENERATION_MODEL = previousModel;
        }
    });

    it("does not fail a successful call when telemetry persistence fails", async () => {
        const previousModel = process.env.OPENROUTER_GENERATION_MODEL;
        process.env.OPENROUTER_GENERATION_MODEL = "test/model";
        const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ value: "ok" }) } }],
        }), { status: 200 });
        try {
            const client = new OpenRouterClient("test-key", fakeFetch, 1000, { record: async () => { throw new Error("telemetry unavailable"); } });
            assert.deepEqual(await client.completeJson({
                task: "generation", system: "s", user: "u", maxOutputTokens: 100, schema: outputSchema,
            }), { value: "ok" });
        } finally {
            if (previousModel === undefined) delete process.env.OPENROUTER_GENERATION_MODEL;
            else process.env.OPENROUTER_GENERATION_MODEL = previousModel;
        }
    });

    it("records evaluator rejection codes without storing evaluator details", async () => {
        const previousModel = process.env.OPENROUTER_GENERATION_MODEL;
        process.env.OPENROUTER_GENERATION_MODEL = "test/model";
        const records: import("./AiRunTelemetry.js").AiRunRecord[] = [];
        const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ value: "rejected" }) } }],
        }), { status: 200 });
        try {
            const client = new OpenRouterClient("test-key", fakeFetch, 1000, { record: async record => { records.push(record); } });
            await client.completeJson({
                task: "generation", system: "s", user: "u", maxOutputTokens: 100, schema: outputSchema,
                telemetry: {
                    operation: "evaluation", promptVersion: "candidate-evaluation.v1",
                    validationFailureCodes: () => ["FACTUAL_SUPPORT"],
                },
            });
            assert.equal(records[0]?.outcome, "REJECTED");
            assert.equal(records[0]?.failureCategory, "VALIDATION");
            assert.deepEqual(records[0]?.validationFailureCodes, ["FACTUAL_SUPPORT"]);
        } finally {
            if (previousModel === undefined) delete process.env.OPENROUTER_GENERATION_MODEL;
            else process.env.OPENROUTER_GENERATION_MODEL = previousModel;
        }
    });
});

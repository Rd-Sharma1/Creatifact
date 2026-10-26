import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiRunTelemetry, type AiRunRecord } from "./AiRunTelemetry.js";

const run: AiRunRecord = {
    correlationId: "d01ae1f4-e3e2-413b-a765-13f4756b1385",
    artifactRequestId: "b4687374-d4d8-4df1-b795-71d7cf34a550",
    operation: "generation",
    model: "test/model",
    promptVersion: "candidate-generation.v1",
    startedAt: new Date("2026-10-21T00:00:00.000Z"),
    durationMs: 120,
    outcome: "FAILED",
    failureCategory: "UPSTREAM",
    retryAttempt: 1,
    validationFailureCodes: [],
};

describe("AiRunTelemetry", () => {
    it("persists only the supplied metadata", async () => {
        let saved: AiRunRecord | undefined;
        const telemetry = new AiRunTelemetry(async record => { saved = record; });
        await telemetry.record(run);
        assert.deepEqual(saved, run);
        assert.equal(saved?.promptVersion, "candidate-generation.v1");
        assert.equal("system" in (saved as unknown as Record<string, unknown>), false);
        assert.equal("user" in (saved as unknown as Record<string, unknown>), false);
        assert.equal("content" in (saved as unknown as Record<string, unknown>), false);
    });

    it("swallows metadata persistence failures", async () => {
        const telemetry = new AiRunTelemetry(async () => { throw new Error("database unavailable"); });
        await assert.doesNotReject(telemetry.record(run));
    });
});

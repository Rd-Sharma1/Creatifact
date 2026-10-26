import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeLog } from "./logger.js";

describe("structured logging", () => {
    it("emits timestamp, severity, event, and supplied correlation fields", () => {
        const original = console.info;
        let output = "";
        console.info = value => { output = String(value); };
        try {
            writeLog("info", "test.event", { requestId: "request-123", artifactRequestId: "artifact-456" });
        } finally {
            console.info = original;
        }
        const record = JSON.parse(output) as Record<string, unknown>;
        assert.equal(typeof record.timestamp, "string");
        assert.equal(record.severity, "info");
        assert.equal(record.event, "test.event");
        assert.equal(record.requestId, "request-123");
        assert.equal(record.artifactRequestId, "artifact-456");
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigurationError } from "../app/common/errors.js";
import { readEnvironment } from "./environment.js";

describe("environment configuration", () => {
    it("parses a valid port and ignores empty optional deployment secrets", () => {
        const parsed = readEnvironment({ PORT: "8081", GITHUB_APP_CLIENT_SECRET: "", INNGEST_EVENT_KEY: "" });
        assert.equal(parsed.PORT, 8081);
        assert.equal(parsed.GITHUB_APP_CLIENT_SECRET, undefined);
        assert.equal(parsed.INNGEST_EVENT_KEY, undefined);
    });

    it("rejects invalid configuration without echoing secret values", () => {
        assert.throws(() => readEnvironment({ PORT: "not-a-port", GITHUB_APP_CLIENT_SECRET: "synthetic-secret-value" }), error => {
            assert.ok(error instanceof ConfigurationError);
            assert.ok(JSON.stringify(error.details).includes("PORT"));
            assert.ok(!JSON.stringify(error.details).includes("synthetic-secret-value"));
            return true;
        });
    });

    it("requires database settings to use a PostgreSQL URL without attempting a connection", () => {
        assert.throws(() => readEnvironment({ DATABASE_URL: "https://example.test/not-a-database" }), error => {
            assert.ok(error instanceof ConfigurationError);
            assert.ok(JSON.stringify(error.details).includes("DATABASE_URL"));
            assert.ok(!JSON.stringify(error.details).includes("example.test"));
            return true;
        });
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedDevelopmentOrigins, apiRewrites } from "./next.config.js";

describe("development API proxy", () => {
    it("forwards local API paths to Express only in development", async () => {
        assert.deepEqual(apiRewrites("development"), [
            { source: "/api/:path*", destination: "http://localhost:8080/api/:path*" },
        ]);
        assert.deepEqual(apiRewrites("production"), []);
    });
});

describe("development browser origins", () => {
    it("allows HTTPS ngrok frontends to load client assets only in development", () => {
        assert.deepEqual(allowedDevelopmentOrigins("development"), ["*.ngrok-free.dev"]);
        assert.equal(allowedDevelopmentOrigins("production"), undefined);
    });
});

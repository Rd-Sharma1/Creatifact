import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiClientError, AuthenticationRequiredError, apiRequest } from "./api.js";

describe("frontend API client", () => {
    it("includes browser credentials and parses successful JSON", async () => {
        const originalFetch = globalThis.fetch;
        let request: RequestInit | undefined;
        globalThis.fetch = async (_input, init) => {
            request = init;
            return Response.json({ id: "user-id", githubName: "octocat" });
        };
        try {
            const result = await apiRequest<{ id: string }>("/api/auth/me");
            assert.deepEqual(result, { id: "user-id", githubName: "octocat" });
            assert.equal(request?.credentials, "include");
            assert.equal(new Headers(request?.headers).get("Accept"), "application/json");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("maps authentication and validation errors from the shared envelope", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => Response.json({
            error: { code: "VALIDATION_ERROR", message: "Request validation failed" },
            requestId: "request-id",
        }, { status: 422 });
        try {
            await assert.rejects(apiRequest("/api/artifact-requests"), (error: unknown) => {
                assert.ok(error instanceof ApiClientError);
                assert.equal(error.code, "VALIDATION_ERROR");
                assert.equal(error.status, 422);
                assert.equal(error.requestId, "request-id");
                return true;
            });
        } finally {
            globalThis.fetch = originalFetch;
        }

        globalThis.fetch = async () => Response.json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" }, requestId: null }, { status: 401 });
        try {
            await assert.rejects(apiRequest("/api/auth/me"), AuthenticationRequiredError);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("reports network failures and malformed API responses safely", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error("private network detail"); };
        try {
            await assert.rejects(apiRequest("/api/auth/me"), (error: unknown) => {
                assert.ok(error instanceof ApiClientError);
                assert.equal(error.code, "NETWORK_ERROR");
                assert.equal(error.message.includes("private network detail"), false);
                return true;
            });
        } finally {
            globalThis.fetch = originalFetch;
        }

        globalThis.fetch = async () => new Response("not-json", { status: 200 });
        try {
            await assert.rejects(apiRequest("/api/auth/me"), (error: unknown) => {
                assert.ok(error instanceof ApiClientError);
                assert.equal(error.code, "UNEXPECTED_RESPONSE");
                return true;
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

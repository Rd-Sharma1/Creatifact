import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    ApiClientError,
    AuthenticationRequiredError,
    apiRequest,
    createArtifactRequest,
    discardCandidate,
    editCandidate,
    resolveApiUrl,
    resolveApiRequestUrl,
    selectCandidate,
} from "./api.js";

describe("frontend API client", () => {
    it("supports the local same-origin API proxy while requiring an API base in production", () => {
        assert.equal(resolveApiUrl("/api/auth/me", "", "development"), "/api/auth/me");
        assert.equal(resolveApiUrl("api/auth/me", undefined, "development"), "http://localhost:8080/api/auth/me");
        assert.equal(resolveApiUrl("/api/auth/me", "https://api.example.test/", "production"), "https://api.example.test/api/auth/me");
        assert.throws(() => resolveApiUrl("/api/auth/me", "", "production"), /NEXT_PUBLIC_API_BASE_URL/);
        assert.equal(resolveApiRequestUrl("/api/auth/me", "https://tunnel.example.test", "development", "http://localhost:3000"), "/api/auth/me");
        assert.equal(resolveApiRequestUrl("/api/auth/me", "https://tunnel.example.test", "development", "https://tunnel.example.test"), "https://tunnel.example.test/api/auth/me");
    });

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
            assert.ok(request?.signal instanceof AbortSignal);
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

    it("uses the existing request and candidate action contracts", async () => {
        const originalFetch = globalThis.fetch;
        const calls: Array<{ url: string; method: string; body?: string; credentials?: RequestCredentials; signal?: AbortSignal | null }> = [];
        globalThis.fetch = async (input, init) => {
            calls.push({
                url: String(input),
                method: init?.method ?? "GET",
                ...(typeof init?.body === "string" ? { body: init.body } : {}),
                credentials: init?.credentials,
                signal: init?.signal,
            });
            if (String(input).endsWith("/artifact-requests")) {
                return Response.json({ id: "request-id", repositoryId: "repo-id", artifactTypes: ["X_POST"], scope: { type: "LATEST" }, instructions: null, targetChangeSetIds: ["changeset-id"], supportingChangeSetIds: [], status: "PENDING", createdAt: "2026-01-01T00:00:00.000Z" }, { status: 202 });
            }
            if (String(input).endsWith("/select")) return Response.json({ artifact: { id: "artifact-id" }, candidateStatus: "SELECTED" });
            return Response.json({ candidateId: "candidate-id", status: "updated" });
        };
        try {
            await createArtifactRequest({ repositoryId: "repo-id", artifactTypes: ["X_POST"], scope: { type: "LATEST" }, instructions: "Focus on the migration." });
            await editCandidate("request-id", "candidate-id", "Edited draft");
            await discardCandidate("request-id", "candidate-id");
            await selectCandidate("request-id", "candidate-id");
            assert.deepEqual(calls.map(call => call.method), ["POST", "PATCH", "POST", "POST"]);
            assert.equal(JSON.parse(calls[0]!.body!).repositoryId, "repo-id");
            assert.equal(JSON.parse(calls[0]!.body!).scope.type, "LATEST");
            assert.match(calls[1]!.url, /\/api\/artifact-requests\/request-id\/candidates\/candidate-id$/);
            assert.deepEqual(calls.map(call => call.credentials), ["include", "include", "include", "include"]);
            assert.deepEqual(calls.map(call => call.signal), [undefined, undefined, undefined, undefined]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

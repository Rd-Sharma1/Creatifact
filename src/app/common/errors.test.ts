import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { z } from "zod";
import { apiErrorEnvelope, errorMiddleware } from "./errorMiddleware.js";
import {
    ApplicationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    ConfigurationError,
    DependencyUnavailableError,
    DomainValidationError,
    NotFoundError,
    RequestValidationError,
    UpstreamProviderError,
} from "./errors.js";
import { parseOrThrow } from "./validation.js";

describe("shared API errors", () => {
    it("maps expected errors to one envelope with stable codes and statuses", () => {
        const cases: Array<[ApplicationError, number, string]> = [
            [new RequestValidationError(), 400, "VALIDATION_ERROR"],
            [new AuthenticationError(), 401, "AUTHENTICATION_REQUIRED"],
            [new AuthorizationError(), 403, "FORBIDDEN"],
            [new NotFoundError(), 404, "NOT_FOUND"],
            [new ConflictError(), 409, "CONFLICT"],
            [new DomainValidationError("EMPTY_SCOPE", "No matching work"), 422, "EMPTY_SCOPE"],
            [new UpstreamProviderError("OpenRouter", 429), 503, "UPSTREAM_PROVIDER_ERROR"],
            [new UpstreamProviderError("GitHub", 502), 502, "UPSTREAM_PROVIDER_ERROR"],
            [new ConfigurationError({ variables: ["DATABASE_URL"] }), 503, "SERVICE_CONFIGURATION_ERROR"],
            [new DependencyUnavailableError("database"), 503, "DEPENDENCY_UNAVAILABLE"],
        ];

        for (const [error, status, code] of cases) {
            const mapped = apiErrorEnvelope(error, "request-123");
            assert.equal(mapped.status, status);
            assert.deepEqual(mapped.body, {
                error: {
                    code,
                    message: error.publicMessage,
                    ...(error.details ? { details: error.details } : {}),
                },
                requestId: "request-123",
            });
        }
    });

    it("exposes only safe Zod paths and codes for malformed input", () => {
        assert.throws(() => parseOrThrow(z.object({ repositoryId: z.uuid() }), { repositoryId: "private-token-value" }), error => {
            assert.ok(error instanceof RequestValidationError);
            const mapped = apiErrorEnvelope(error, "request-456");
            assert.equal(mapped.status, 400);
            assert.deepEqual(mapped.body.error.details, { issues: [{ path: "repositoryId", code: "invalid_format" }] });
            assert.ok(!JSON.stringify(mapped.body).includes("private-token-value"));
            return true;
        });
    });

    it("maps malformed JSON to the same envelope", () => {
        const mapped = apiErrorEnvelope({ type: "entity.parse.failed", body: "secret body" }, "request-789");
        assert.equal(mapped.status, 400);
        assert.deepEqual(mapped.body, {
            error: { code: "INVALID_JSON", message: "Request body contains invalid JSON" },
            requestId: "request-789",
        });
    });

    it("maps oversized and unsupported request bodies to safe client errors", () => {
        const oversized = apiErrorEnvelope({ type: "entity.too.large", body: "private body" }, "request-413");
        assert.equal(oversized.status, 413);
        assert.equal(oversized.body.error.code, "PAYLOAD_TOO_LARGE");
        assert.ok(!JSON.stringify(oversized).includes("private body"));

        const encoding = apiErrorEnvelope({ type: "encoding.unsupported", encoding: "private" }, "request-415");
        assert.equal(encoding.status, 415);
        assert.equal(encoding.body.error.code, "UNSUPPORTED_ENCODING");
    });

    it("hides unexpected and upstream details while logging only structured safe context", () => {
        const originalError = console.error;
        let logged = "";
        console.error = value => { logged = String(value); };
        try {
            const response = {
                locals: { requestId: "request-safe" },
                headersSent: false,
                statusCode: 0,
                body: undefined as unknown,
                status(code: number) { this.statusCode = code; return this; },
                json(body: unknown) { this.body = body; return this; },
            };
            errorMiddleware(
                new Error("raw prompt, provider response, credential=synthetic-secret"),
                { method: "POST", path: "/api/example" } as Request,
                response as unknown as Response,
                () => undefined,
            );
            assert.equal(response.statusCode, 500);
            assert.deepEqual(response.body, {
                error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
                requestId: "request-safe",
            });
            assert.ok(!logged.includes("synthetic-secret"));
            assert.ok(!logged.includes("raw prompt"));
            assert.ok(logged.includes("POST"));
            assert.ok(logged.includes("request-safe"));
        } finally {
            console.error = originalError;
        }
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { corsMiddleware } from "./cors.js";

function runCors(input: {
    method: string;
    origin?: string;
    requestMethod?: string;
    requestHeaders?: string;
}) {
    const headers = new Map<string, string>();
    let statusCode: number | undefined;
    let ended = false;
    let nextError: unknown;
    const req = {
        method: input.method,
        headers: {
            ...(input.origin ? { origin: input.origin } : {}),
            ...(input.requestMethod ? { "access-control-request-method": input.requestMethod } : {}),
            ...(input.requestHeaders ? { "access-control-request-headers": input.requestHeaders } : {}),
        },
    } as Request;
    const res = {
        vary: (name: string) => { headers.set("Vary", name); return res; },
        setHeader: (name: string, value: string) => { headers.set(name, value); return res; },
        status: (value: number) => { statusCode = value; return res; },
        end: () => { ended = true; return res; },
    } as unknown as Response;
    const next: NextFunction = error => { nextError = error; };

    corsMiddleware(req, res, next);
    return { headers, statusCode, ended, nextError };
}

describe("credentialed CORS middleware", () => {
    it("allows the configured local frontend origin and credentials on actual requests", () => {
        const previous = process.env.APP_ORIGIN;
        process.env.APP_ORIGIN = "http://localhost:3000";
        try {
            for (const method of ["GET", "POST", "PATCH"]) {
                const result = runCors({ method, origin: "http://localhost:3000" });
                assert.equal(result.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
                assert.equal(result.headers.get("Access-Control-Allow-Credentials"), "true");
            }
            const wrongOrigin = runCors({ method: "GET", origin: "https://gentile-oblivion-otter.ngrok-free.dev" });
            assert.equal(wrongOrigin.headers.has("Access-Control-Allow-Origin"), false);
        } finally {
            if (previous === undefined) delete process.env.APP_ORIGIN;
            else process.env.APP_ORIGIN = previous;
        }
    });

    it("answers local POST and PATCH preflights without wildcard origins", () => {
        const previous = process.env.APP_ORIGIN;
        process.env.APP_ORIGIN = "http://localhost:3000";
        try {
            for (const method of ["POST", "PATCH"]) {
                const result = runCors({
                    method: "OPTIONS",
                    origin: "http://localhost:3000",
                    requestMethod: method,
                    requestHeaders: "content-type, accept",
                });
                assert.equal(result.statusCode, 204);
                assert.equal(result.ended, true);
                assert.equal(result.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
                assert.equal(result.headers.get("Access-Control-Allow-Credentials"), "true");
                assert.notEqual(result.headers.get("Access-Control-Allow-Origin"), "*");
            }
        } finally {
            if (previous === undefined) delete process.env.APP_ORIGIN;
            else process.env.APP_ORIGIN = previous;
        }
    });

    it("allows the exact configured origin with credentials and required API methods", () => {
        const previous = process.env.APP_ORIGIN;
        process.env.APP_ORIGIN = "https://creatifact.ridam.in";
        try {
            const result = runCors({
                method: "OPTIONS",
                origin: "https://creatifact.ridam.in",
                requestMethod: "PATCH",
                requestHeaders: "content-type, accept",
            });
            assert.equal(result.statusCode, 204);
            assert.equal(result.ended, true);
            assert.equal(result.headers.get("Access-Control-Allow-Origin"), "https://creatifact.ridam.in");
            assert.equal(result.headers.get("Access-Control-Allow-Credentials"), "true");
            assert.equal(result.headers.get("Access-Control-Allow-Methods"), "GET, HEAD, POST, PATCH, OPTIONS");
            assert.equal(result.headers.get("Access-Control-Allow-Headers"), "Accept, Content-Type");
            assert.notEqual(result.headers.get("Access-Control-Allow-Origin"), "*");
            assert.equal(result.nextError, undefined);
        } finally {
            if (previous === undefined) delete process.env.APP_ORIGIN;
            else process.env.APP_ORIGIN = previous;
        }
    });

    it("does not grant CORS access to other origins or unsupported preflight headers", () => {
        const previous = process.env.APP_ORIGIN;
        process.env.APP_ORIGIN = "https://creatifact.ridam.in";
        try {
            const otherOrigin = runCors({ method: "GET", origin: "https://evil.ridam.in" });
            assert.equal(otherOrigin.headers.has("Access-Control-Allow-Origin"), false);

            const unsupportedHeader = runCors({
                method: "OPTIONS",
                origin: "https://creatifact.ridam.in",
                requestMethod: "POST",
                requestHeaders: "authorization",
            });
            assert.equal(unsupportedHeader.ended, false);
            assert.equal((unsupportedHeader.nextError as Error).name, "AuthorizationError");
        } finally {
            if (previous === undefined) delete process.env.APP_ORIGIN;
            else process.env.APP_ORIGIN = previous;
        }
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requestContextMiddleware } from "./requestContext.js";

describe("requestContextMiddleware", () => {
    it("generates its own UUID instead of trusting a caller-supplied request ID", () => {
        const headers: Record<string, string> = {};
        const locals: Record<string, unknown> = {};
        const request = { method: "GET", path: "/health/live", headers: { "x-request-id": "caller-controlled" } };
        const response = {
            locals,
            setHeader: (name: string, value: string) => { headers[name] = value; },
            on: () => response,
        };
        let nextCalled = false;
        requestContextMiddleware(request as never, response as never, () => { nextCalled = true; });

        assert.equal(typeof locals.requestId, "string");
        assert.match(String(locals.requestId), /^[0-9a-f-]{36}$/i);
        assert.notEqual(locals.requestId, request.headers["x-request-id"]);
        assert.equal(headers["x-request-id"], locals.requestId);
        assert.equal(nextCalled, true);
    });
});

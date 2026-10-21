import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { ApplicationError } from "./errors.js";
import { safeZodDetails } from "./validation.js";

export type ApiErrorEnvelope = {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    requestId: string | null;
};

export function apiErrorEnvelope(error: unknown, requestId: string | undefined): { status: number; body: ApiErrorEnvelope } {
    const applicationError = error instanceof ApplicationError
        ? error
        : error instanceof z.ZodError
            ? { code: "VALIDATION_ERROR", status: 400, publicMessage: "Request validation failed", details: safeZodDetails(error) }
            : undefined;
    const malformedJson = isMalformedJson(error);
    const parserStatus = malformedJson ? 400 : isPayloadTooLarge(error) ? 413 : isUnsupportedEncoding(error) ? 415 : undefined;
    const status = applicationError?.status ?? parserStatus ?? 500;
    const body: ApiErrorEnvelope = {
        error: {
            code: applicationError?.code ?? (malformedJson ? "INVALID_JSON" : isPayloadTooLarge(error) ? "PAYLOAD_TOO_LARGE" : isUnsupportedEncoding(error) ? "UNSUPPORTED_ENCODING" : "INTERNAL_SERVER_ERROR"),
            message: applicationError?.publicMessage ?? (malformedJson ? "Request body contains invalid JSON" : isPayloadTooLarge(error) ? "Request body is too large" : isUnsupportedEncoding(error) ? "Request encoding is not supported" : "Internal server error"),
            ...(applicationError?.details ? { details: applicationError.details } : {}),
        },
        requestId: requestId ?? null,
    };
    return { status, body };
}

export const errorMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
    const mapped = apiErrorEnvelope(error, res.locals.requestId);
    const log = {
        event: "http.request.failed",
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        statusCode: mapped.status,
        errorCode: mapped.body.error.code,
        errorName: error instanceof Error ? error.name : "UnknownError",
        ...(error instanceof Error && error.cause instanceof Error ? { causeName: error.cause.name } : {}),
    };
    if (mapped.status >= 500) console.error(JSON.stringify(log));
    else console.warn(JSON.stringify(log));

    if (res.headersSent) return;
    res.status(mapped.status).json(mapped.body);
};

function isMalformedJson(error: unknown): boolean {
    return typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed";
}

function isPayloadTooLarge(error: unknown): boolean {
    return typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large";
}

function isUnsupportedEncoding(error: unknown): boolean {
    return typeof error === "object" && error !== null && "type" in error && error.type === "encoding.unsupported";
}

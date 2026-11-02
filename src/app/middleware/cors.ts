import type { NextFunction, Request, Response } from "express";
import { AuthorizationError } from "../common/errors.js";

const allowedMethods = ["GET", "HEAD", "POST", "PATCH", "OPTIONS"] as const;
const allowedHeaders = ["accept", "content-type"] as const;

export function isAllowedOrigin(origin: string | undefined, expectedOrigin: string | undefined): boolean {
    if (!origin || !expectedOrigin) return false;
    try {
        return origin === new URL(expectedOrigin).origin;
    } catch {
        return false;
    }
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    const allowedOrigin = isAllowedOrigin(origin, process.env.APP_ORIGIN);

    if (origin && allowedOrigin) {
        res.vary("Origin");
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (req.method !== "OPTIONS") {
        next();
        return;
    }

    const requestedMethod = req.headers["access-control-request-method"]?.toUpperCase();
    const requestedHeaders = (req.headers["access-control-request-headers"] ?? "")
        .split(",")
        .map(header => header.trim().toLowerCase())
        .filter(Boolean);
    if (!allowedOrigin || (requestedMethod && !allowedMethods.includes(requestedMethod as typeof allowedMethods[number])) ||
        requestedHeaders.some(header => !allowedHeaders.includes(header as typeof allowedHeaders[number]))) {
        next(new AuthorizationError("CORS preflight is not allowed"));
        return;
    }

    res.setHeader("Access-Control-Allow-Methods", allowedMethods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
    res.status(204).end();
}

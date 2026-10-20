import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    console.info(JSON.stringify({ event: "http.request.started", requestId, method: req.method, path: req.path }));
    res.on("finish", () => {
        console.info(JSON.stringify({ event: "http.request.finished", requestId, statusCode: res.statusCode }));
    });
    next();
};

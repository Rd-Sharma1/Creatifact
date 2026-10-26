import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { writeLog } from "../common/logger.js";

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    writeLog("info", "http.request.started", { requestId, method: req.method });
    res.on("finish", () => {
        writeLog("info", "http.request.finished", { requestId, method: req.method, statusCode: res.statusCode });
    });
    next();
};

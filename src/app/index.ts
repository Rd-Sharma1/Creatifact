import type { ErrorRequestHandler, Express } from "express";
import express from "express";
import { serve } from "inngest/express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { inngest } from "./modules/inngest/client.js";
import { functions } from "./modules/inngest/index.js";
import { artifactRequestRouter } from "./modules/artifact-request/routes.js";
import { webhookRouter } from "./modules/webhook/routes.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";

export function createApplications(): Express {
    //Intialize express application
    const app = express();
    app.use(requestContextMiddleware);

    //This route needs the raw body for signature verification, so this is before the express.json() middleware
    app.use("/api/webhook", webhookRouter);

    //Middleware
    app.use(express.json());

    app.use("/api/artifact-requests", artifactRequestRouter);

    app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
    app.get("/health/ready", async (_req, res) => {
        const missingConfiguration = ["DATABASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_GENERATION_MODEL", "OPENROUTER_SCOPE_MODEL"]
            .filter(name => !process.env[name]);
        if (missingConfiguration.length > 0) {
            res.status(503).json({ status: "not_ready", missingConfiguration });
            return;
        }
        try {
            await db.execute(sql`select 1`);
            res.status(200).json({ status: "ready" });
        } catch {
            res.status(503).json({ status: "not_ready" });
        }
    });

    app.use(
        // Expose the middleware on our recommended path at `/api/inngest`.
        "/api/inngest",
        serve({ client: inngest, functions }),
    );

    //Routes
    app.get("/", (req, res) => {
        res.send("Welcome to Creatifact!!");
    });

    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        console.error(JSON.stringify({ event: "http.request.failed", requestId: res.locals.requestId, errorName: error instanceof Error ? error.name : "UnknownError" }));
        if (res.headersSent) return;
        const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
            ? error.status
            : 500;
        if (status >= 400 && status < 500) {
            res.status(status).json({ error: "Invalid request", requestId: res.locals.requestId });
            return;
        }
        res.status(500).json({ error: "Internal server error", requestId: res.locals.requestId });
    };
    app.use(errorHandler);

    return app;
}

import type { Express } from "express";
import express from "express";
import { serve } from "inngest/express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { inngest } from "./modules/inngest/client.js";
import { functions } from "./modules/inngest/index.js";
import { artifactRequestRouter } from "./modules/artifact-request/routes.js";
import { webhookRouter } from "./modules/webhook/routes.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { authRouter, repositoryRouter } from "./modules/auth/routes.js";
import { errorMiddleware } from "./common/errorMiddleware.js";
import { ConfigurationError, DependencyUnavailableError, NotFoundError } from "./common/errors.js";

export function createApplications(): Express {
    //Intialize express application
    const app = express();
    app.use(requestContextMiddleware);

    //This route needs the raw body for signature verification, so this is before the express.json() middleware
    app.use("/api/webhook", webhookRouter);

    //Middleware
    app.use(express.json());

    app.use("/api/auth", authRouter);
    app.use("/api/repositories", repositoryRouter);
    app.use("/api/artifact-requests", artifactRequestRouter);

    app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
    app.get("/health/ready", async (_req, res) => {
        const missingConfiguration = ["DATABASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_GENERATION_MODEL", "OPENROUTER_SCOPE_MODEL", "GITHUB_APP_ID", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_CALLBACK_URL", "GITHUB_APP_SLUG", "GITHUB_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET", "APP_ORIGIN"]
            .filter(name => !process.env[name]);
        if (process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_SECURE !== "true") {
            missingConfiguration.push("AUTH_COOKIE_SECURE");
        }
        if (missingConfiguration.length > 0) {
            throw new ConfigurationError({ variables: missingConfiguration });
        }
        try {
            await db.execute(sql`select 1`);
            res.status(200).json({ status: "ready" });
        } catch (error) {
            throw new DependencyUnavailableError("database", { cause: error });
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

    app.use((_req, _res, next) => next(new NotFoundError("Route not found")));
    app.use(errorMiddleware);

    return app;
}

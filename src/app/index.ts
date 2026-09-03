import type { Express } from "express";
import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./modules/inngest/client.js";
import { functions } from "./modules/inngest/index.js";
import { webhookRouter } from "./modules/webhook/routes.js";

export function createApplications(): Express {
    //Intialize express application
    const app = express();

    //This route needs the raw body for signature verification, so this is before the express.json() middleware
    app.use("/api/webhook", webhookRouter);

    //Middleware
    app.use(express.json());

    app.use(
        // Expose the middleware on our recommended path at `/api/inngest`.
        "/api/inngest",
        serve({ client: inngest, functions }),
    );

    //Routes
    app.get("/", (req, res) => {
        console.log("Welcome to Creatifact!!");
        res.send("Welcome to Creatifact!!");
    });

    return app;
}

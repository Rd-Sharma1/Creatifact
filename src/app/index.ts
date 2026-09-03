import type { Express } from "express";
import express from "express";
import { webhookRouter } from "./modules/webhook/routes.js";

export function createApplications(): Express {
    //Intialize express application
    const app = express();

    //This route needs the raw body for signature verification, so this is before the express.json() middleware
    app.use("/api/webhook", webhookRouter);

    //Middleware
    app.use(express.json());

    //Routes
    app.get("/", (req, res) => {
        console.log("Welcome to Creatifact!!");
        res.send("Welcome to Creatifact!!");
    });

    return app;
}

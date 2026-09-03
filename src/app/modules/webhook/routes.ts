import type { Router } from "express";
import express from "express";
import * as webhookController from "./controller.js";
import { validateWebhookSignature } from "./middleware.js";

const webhookRouter: Router = express.Router();

webhookRouter.post(
    "/github",
    express.raw({ type: "application/json" }),
    validateWebhookSignature,
    webhookController.handleWebhookEvent,
);

export { webhookRouter };

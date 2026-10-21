import type { NextFunction, Request, Response } from "express";

//Importing Octokit right here... maybe we should move it somewhere else
import { Webhooks } from "@octokit/webhooks";
import "dotenv/config";
import { AuthenticationError, ConfigurationError, RequestValidationError } from "../../common/errors.js";

function webhookVerifier(): Webhooks {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw new ConfigurationError({ variables: ["GITHUB_WEBHOOK_SECRET"] });
    return new Webhooks({ secret });
}

const validateWebhookSignature = async (req: Request, _res: Response, next: NextFunction) => {
    let signature = req.headers["x-hub-signature-256"];

    if (!signature || Array.isArray(signature)) {
        throw new RequestValidationError({ field: "x-hub-signature-256" });
    }

    const [algorithm, token] = signature.split("=");

    if (algorithm !== "sha256" || !token) {
        throw new RequestValidationError({ field: "x-hub-signature-256" });
    }

    const body = req.body.toString("utf8");

    //console.log("Body type:", Buffer.isBuffer(body));     true
    //console.log("Body length:", body.length);       around 7k

    if (!(await webhookVerifier().verify(body, signature))) throw new AuthenticationError("Webhook signature could not be verified");

    next();
};

export { validateWebhookSignature };

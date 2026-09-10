import type { NextFunction, Request, Response } from "express";

//Importing Octokit right here... maybe we should move it somewhere else
import { Webhooks } from "@octokit/webhooks";
import "dotenv/config";

const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not defined");
}
const webhooks = new Webhooks({
    secret: secret,
});

const validateWebhookSignature = async (req: Request, res: Response, next: NextFunction) => {
    let signature = req.headers["x-hub-signature-256"];
    // console.log("Signature:", signatureObj);

    if (!signature || Array.isArray(signature)) {
        res.status(400).send("Missing or invalid signature");
        return;
    }

    const [algorithm, token] = signature.split("=");

    if (algorithm !== "sha256" || !token) {
        res.status(400).send("Invalid signature");
        return;
    }

    const body = req.body.toString("utf8");

    //console.log("Body type:", Buffer.isBuffer(body));     true
    //console.log("Body length:", body.length);       around 7k

    if (!(await webhooks.verify(body, signature))) {
        res.status(401).send("Unauthorized");
        return;
    }

    next();
};

export { validateWebhookSignature };

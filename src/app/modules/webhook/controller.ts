import type { Request, Response } from "express";

const handleWebhookEvent = async (req: Request, res: Response) => {
    console.log("Received webhook event");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);

    const payload = JSON.parse(req.body);
    console.log("Parsed payload:", payload);

    const type = req.headers["x-github-event"];
    if (!type || typeof type !== "string") {
        res.status(400).send("Missing or invalid event type");
        return;
    }

    res.sendStatus(200);

    console.log(`Received event: ${type}`);
    console.log(`Payload: ${JSON.stringify(payload)}`);
};

export { handleWebhookEvent };

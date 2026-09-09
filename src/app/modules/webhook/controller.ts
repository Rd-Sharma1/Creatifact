import type { Request, Response } from "express";
import { pushEventService } from "./service.js";

const handleWebhookEvent = async (req: Request, res: Response) => {
    console.log("Received webhook event");
    // console.log("Headers:", req.headers);
    // console.log("Body:", req.body);

    const payload = JSON.parse(req.body);
    // console.log("Parsed payload:", payload);

    const type = req.headers["x-github-event"];
    if (!type || typeof type !== "string") {
        res.status(400).send("Missing or invalid event type");
        return;
    }

    switch (type) {
        case "push":
            console.log("Handling push event");
            pushEventService(payload);
            break;

        default:
            console.log(`${type} is not a getting handled yet`);
            res.status(400).send("Invalid event");
            break;
    }

    res.sendStatus(200);

    console.log(`Done with event: ${type}`);
};

export { handleWebhookEvent };

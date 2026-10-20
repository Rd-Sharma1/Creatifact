import type { Request, Response } from "express";
import { z } from "zod";
import { pushEventService, type GithubPushWebhookPayload } from "../github/GithubEventServices.js";
import { handleInstallationWebhook } from "../auth/githubAuth.js";

const githubIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const pushEventSchema: z.ZodType<GithubPushWebhookPayload> = z.object({
    installation: z.object({ id: githubIdSchema }),
    ref: z.string(),
    repository: z.object({ id: githubIdSchema, name: z.string(), owner: z.object({ login: z.string() }) }),
    before: z.string(),
    after: z.string(),
    compare: z.string(),
});
const installationSchema = z.object({
    id: githubIdSchema,
    app_id: githubIdSchema,
    account: z.object({ id: githubIdSchema, login: z.string().min(1), type: z.string().min(1) }),
});
const installationEventSchema = z.object({
    action: z.enum(["created", "deleted", "suspend", "unsuspend", "new_permissions_accepted"]),
    installation: installationSchema,
});
const installationRepositoriesEventSchema = z.object({
    action: z.enum(["added", "removed"]),
    installation: z.object({ id: githubIdSchema, app_id: githubIdSchema }),
    repositories_added: z.array(z.object({
        id: githubIdSchema, name: z.string(), owner: z.object({ login: z.string() }),
    })).optional(),
    repositories_removed: z.array(z.object({ id: githubIdSchema })).optional(),
});

const handleWebhookEvent = async (req: Request, res: Response) => {
    let payload: unknown;
    try {
        payload = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body));
    } catch {
        res.status(400).send("Invalid JSON payload");
        return;
    }

    const type = req.headers["x-github-event"];
    if (!type || typeof type !== "string") {
        res.status(400).send("Missing or invalid event type");
        return;
    }

    switch (type) {
        case "push":
            {
                const parsed = pushEventSchema.safeParse(payload);
                if (!parsed.success) {
                    res.status(400).send("Invalid push event");
                    return;
                }
                await pushEventService(parsed.data);
            }
            break;

        case "installation": {
            const parsed = installationEventSchema.safeParse(payload);
            if (!parsed.success) {
                res.status(400).send("Invalid installation event");
                return;
            }
            if (parsed.data.installation.app_id !== Number(process.env.GITHUB_APP_ID)) {
                res.status(200).send("Ignored event for another GitHub App");
                return;
            }
            if (parsed.data.action === "created") {
                await handleInstallationWebhook({ action: "created", installation: parsed.data.installation });
            } else if (parsed.data.action === "deleted") {
                await handleInstallationWebhook({ action: "deleted", installationId: parsed.data.installation.id });
            } else if (parsed.data.action === "suspend" || parsed.data.action === "unsuspend" || parsed.data.action === "new_permissions_accepted") {
                await handleInstallationWebhook({
                    action: parsed.data.action === "suspend" ? "suspended" : parsed.data.action === "unsuspend" ? "unsuspended" : "permission_updated",
                    installationId: parsed.data.installation.id,
                });
            }
            break;
        }

        case "installation_repositories": {
            const parsed = installationRepositoriesEventSchema.safeParse(payload);
            if (!parsed.success) {
                res.status(400).send("Invalid installation repository event");
                return;
            }
            if (parsed.data.installation.app_id !== Number(process.env.GITHUB_APP_ID)) {
                res.status(200).send("Ignored event for another GitHub App");
                return;
            }
            const repositories = parsed.data.action === "added"
                ? parsed.data.repositories_added ?? []
                : parsed.data.repositories_removed ?? [];
            await handleInstallationWebhook({
                action: parsed.data.action === "added" ? "repositories_added" : "repositories_removed",
                installationId: parsed.data.installation.id,
                repositories,
            });
            break;
        }

        default:
            // GitHub may deliver subscribed events that do not affect this service.
            break;
    }

    res.sendStatus(200);

};

export { handleWebhookEvent };

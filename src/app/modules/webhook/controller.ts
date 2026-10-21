import type { Request, Response } from "express";
import { z } from "zod";
import { pushEventService } from "../github/GithubEventServices.js";
import { handleInstallationWebhook } from "../auth/githubAuth.js";
import { ConfigurationError, RequestValidationError } from "../../common/errors.js";
import { parseOrThrow } from "../../common/validation.js";
import { githubPushWebhookSchema } from "../github/eventSchemas.js";

const githubIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const installationSchema = z.object({
    id: githubIdSchema,
    app_id: githubIdSchema,
    account: z.object({ id: githubIdSchema, login: z.string().min(1).max(100), type: z.string().min(1).max(100) }),
});
const installationEventSchema = z.object({
    action: z.enum(["created", "deleted", "suspend", "unsuspend", "new_permissions_accepted"]),
    installation: installationSchema,
});
const installationRepositoriesEventSchema = z.object({
    action: z.enum(["added", "removed"]),
    installation: z.object({ id: githubIdSchema, app_id: githubIdSchema }),
    repositories_added: z.array(z.object({
        id: githubIdSchema, name: z.string().min(1).max(100), owner: z.object({ login: z.string().min(1).max(100) }),
    })).optional(),
    repositories_removed: z.array(z.object({ id: githubIdSchema })).optional(),
});

function configuredGithubAppId(): number {
    const value = process.env.GITHUB_APP_ID;
    const appId = Number(value);
    if (!value || !Number.isSafeInteger(appId) || appId <= 0) {
        throw new ConfigurationError({ variables: ["GITHUB_APP_ID"] });
    }
    return appId;
}

const handleWebhookEvent = async (req: Request, res: Response) => {
    let payload: unknown;
    try {
        payload = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body));
    } catch {
        throw new RequestValidationError(undefined, "Request body contains invalid JSON");
    }

    const type = req.headers["x-github-event"];
    if (!type || typeof type !== "string") {
        throw new RequestValidationError({ field: "x-github-event" });
    }

    switch (type) {
        case "push":
            {
                await pushEventService(parseOrThrow(githubPushWebhookSchema, payload));
            }
            break;

        case "installation": {
            const event = parseOrThrow(installationEventSchema, payload);
            if (event.installation.app_id !== configuredGithubAppId()) {
                res.status(200).send("Ignored event for another GitHub App");
                return;
            }
            if (event.action === "created") {
                await handleInstallationWebhook({ action: "created", installation: event.installation });
            } else if (event.action === "deleted") {
                await handleInstallationWebhook({ action: "deleted", installationId: event.installation.id });
            } else if (event.action === "suspend" || event.action === "unsuspend" || event.action === "new_permissions_accepted") {
                await handleInstallationWebhook({
                    action: event.action === "suspend" ? "suspended" : event.action === "unsuspend" ? "unsuspended" : "permission_updated",
                    installationId: event.installation.id,
                });
            }
            break;
        }

        case "installation_repositories": {
            const event = parseOrThrow(installationRepositoriesEventSchema, payload);
            if (event.installation.app_id !== configuredGithubAppId()) {
                res.status(200).send("Ignored event for another GitHub App");
                return;
            }
            const repositories = event.action === "added"
                ? event.repositories_added ?? []
                : event.repositories_removed ?? [];
            await handleInstallationWebhook({
                action: event.action === "added" ? "repositories_added" : "repositories_removed",
                installationId: event.installation.id,
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

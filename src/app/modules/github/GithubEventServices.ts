import { inngest } from "../inngest/client.js";
import { parseOrThrow } from "../../common/validation.js";
import { githubPushReceivedEventSchema } from "../inngest/eventSchemas.js";
import type { GithubPushWebhookPayload } from "./eventSchemas.js";

export type { GithubPushWebhookPayload } from "./eventSchemas.js";

const pushEventService = async (payload: GithubPushWebhookPayload) => {
    const data = parseOrThrow(githubPushReceivedEventSchema, {
        installationId: payload.installation.id,
        ref: payload.ref,
        githubRepoId: payload.repository.id,
        repositoryName: payload.repository.name,
        owner: payload.repository.owner.login,
        before: payload.before,
        after: payload.after,
        compareUrl: payload.compare,
    });
    await inngest.send({
        name: "github/push.received",
        data,
    });
};

export { pushEventService };

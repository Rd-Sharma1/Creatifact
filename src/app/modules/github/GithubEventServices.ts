import { inngest } from "../inngest/client.js";

export type GithubPushWebhookPayload = {
    installation: { id: number };
    ref: string;
    repository: { id: number; name: string; owner: { login: string } };
    before: string;
    after: string;
    compare: string;
};

const pushEventService = async (payload: GithubPushWebhookPayload) => {
    await inngest.send({
        name: "github/push.received",
        data: {
            installationId: payload.installation.id,
            ref: payload.ref,
            githubRepoId: payload.repository.id,
            repositoryName: payload.repository.name,
            owner: payload.repository.owner.login,
            before: payload.before,
            after: payload.after,
            compareUrl: payload.compare,
        },
    });
};

export { pushEventService };

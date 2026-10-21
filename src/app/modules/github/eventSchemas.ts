import { z } from "zod";

const githubIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const githubPushWebhookSchema = z.object({
    installation: z.object({ id: githubIdSchema }),
    ref: z.string().min(1).max(1024),
    repository: z.object({ id: githubIdSchema, name: z.string().min(1).max(100), owner: z.object({ login: z.string().min(1).max(100) }) }),
    before: z.string().min(1),
    after: z.string().min(1),
    compare: z.string().max(2048),
});

export type GithubPushWebhookPayload = z.infer<typeof githubPushWebhookSchema>;

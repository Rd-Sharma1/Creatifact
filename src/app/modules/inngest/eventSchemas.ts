import { z } from "zod";

const githubIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const githubPushReceivedEventSchema = z.object({
    installationId: githubIdSchema,
    ref: z.string().min(1).max(1024),
    githubRepoId: githubIdSchema,
    repositoryName: z.string().min(1).max(100),
    owner: z.string().min(1).max(100),
    before: z.string().min(1),
    after: z.string().min(1),
    compareUrl: z.string().max(2048),
});

export const artifactGenerationRequestedEventSchema = z.object({ artifactRequestId: z.uuid() });
export const changeSetCreatedEventSchema = z.object({ changeSetId: z.uuid() });

export type GithubPushReceivedEvent = z.infer<typeof githubPushReceivedEventSchema>;
export type ArtifactGenerationRequestedEvent = z.infer<typeof artifactGenerationRequestedEventSchema>;
export type ChangeSetCreatedEvent = z.infer<typeof changeSetCreatedEventSchema>;

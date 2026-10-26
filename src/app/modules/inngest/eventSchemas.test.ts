import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { githubPushWebhookSchema } from "../github/eventSchemas.js";
import { artifactGenerationRequestedEventSchema, githubPushReceivedEventSchema } from "./eventSchemas.js";

describe("external event schemas", () => {
    it("accepts a structurally valid push webhook and its normalized event", () => {
        const webhook = githubPushWebhookSchema.parse({
            installation: { id: 10 }, ref: "refs/heads/main",
            repository: { id: 20, name: "project", owner: { login: "example" } },
            before: "before-sha", after: "after-sha", compare: "https://github.com/example/project/compare/before...after",
        });
        assert.equal(webhook.repository.id, 20);
        assert.equal(githubPushReceivedEventSchema.safeParse({
            installationId: 10, githubRepoId: 20, ref: webhook.ref, owner: "example", repositoryName: "project",
            before: webhook.before, after: webhook.after, compareUrl: webhook.compare,
        }).success, true);
    });

    it("rejects malformed workflow references", () => {
        assert.equal(artifactGenerationRequestedEventSchema.safeParse({ artifactRequestId: "not-a-uuid" }).success, false);
        assert.equal(artifactGenerationRequestedEventSchema.safeParse({
            artifactRequestId: "b4687374-d4d8-4df1-b795-71d7cf34a550", correlationId: "untrusted-id",
        }).success, false);
        assert.equal(githubPushReceivedEventSchema.safeParse({ installationId: 0 }).success, false);
    });
});

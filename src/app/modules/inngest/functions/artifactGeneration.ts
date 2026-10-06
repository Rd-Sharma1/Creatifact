import { artifactGenerationWorkflowService } from "../../artifact-generation/ArtifactGenerationWorkflowService.js";
import { inngest } from "../client.js";

export const artifactGeneration = inngest.createFunction(
    {
        id: "generate-artifacts-for-request",
        name: "Generate artifacts for ArtifactRequest",
        triggers: [{ event: "artifact/generation.requested" }],
        concurrency: { limit: 1, key: "event.data.artifactRequestId" },
        onFailure: async ({ event, step }) => {
            const artifactRequestId = event.data.event.data.artifactRequestId;
            await step.run("mark-artifact-request-failed", async () => {
                await artifactGenerationWorkflowService.markFailed(artifactRequestId);
            });
        },
    },
    async ({ event, step }) => {
        const { artifactRequestId } = event.data;
        return step.run("generate-and-persist-artifacts", async () =>
            artifactGenerationWorkflowService.run(artifactRequestId),
        );
    },
);

import { artifactGenerationWorkflowService } from "../../artifact-generation/ArtifactGenerationWorkflowService.js";
import { inngest } from "../client.js";
import { parseOrThrow } from "../../../common/validation.js";
import { artifactGenerationCancelledEventSchema, artifactGenerationRequestedEventSchema } from "../eventSchemas.js";

export const artifactGeneration = inngest.createFunction(
    {
        id: "generate-artifacts-for-request",
        name: "Generate artifacts for ArtifactRequest",
        triggers: [{ event: "artifact/generation.requested" }],
        concurrency: { limit: 1, key: "event.data.artifactRequestId" },
        onFailure: async ({ event, step }) => {
            const { artifactRequestId } = parseOrThrow(artifactGenerationRequestedEventSchema, event.data.event.data);
            await step.run("mark-artifact-request-failed", async () => {
                await artifactGenerationWorkflowService.markFailed(artifactRequestId);
            });
        },
    },
    async ({ event, step, runId, attempt }) => {
        const { artifactRequestId, correlationId } = parseOrThrow(artifactGenerationRequestedEventSchema, event.data);
        return step.run("generate-and-persist-artifacts", async () =>
            artifactGenerationWorkflowService.run(artifactRequestId, correlationId, runId, attempt),
        );
    },
);

export const artifactGenerationCancelled = inngest.createFunction(
    {
        id: "mark-artifact-request-cancelled",
        name: "Mark cancelled ArtifactRequest generation",
        triggers: [{
            event: "inngest/function.cancelled",
            if: "event.data.function_id == 'creatifact-artifact-app-generate-artifacts-for-request'",
        }],
    },
    async ({ event, step }) => {
        const cancelled = parseOrThrow(artifactGenerationCancelledEventSchema, event.data);
        const { artifactRequestId } = cancelled.event.data;
        await step.run("mark-cancelled-artifact-request-failed", async () => {
            await artifactGenerationWorkflowService.markCancelled(artifactRequestId);
        });
        return { artifactRequestId, handled: true };
    },
);

import { artifactGenerationOutboxService } from "../../artifact-request/ArtifactGenerationOutboxService.js";
import { inngest } from "../client.js";

export const artifactGenerationOutbox = inngest.createFunction(
    {
        id: "dispatch-artifact-generation-outbox",
        name: "Dispatch pending artifact generation requests",
        triggers: [{ cron: "* * * * *" }],
        concurrency: { limit: 1 },
    },
    async ({ step }) => {
        const pending = await step.run("load-pending-generation-events", () => artifactGenerationOutboxService.pending());
        if (pending.length === 0) return { delivered: 0 };
        console.info(JSON.stringify({ event: "artifact_generation_outbox.batch_started", count: pending.length }));

        const ids = pending.map(item => item.id);
        await step.run("record-generation-event-attempt", () => artifactGenerationOutboxService.recordAttempt(ids));
        await step.sendEvent("send-generation-events", pending.map(item => ({
            id: item.id,
            name: "artifact/generation.requested" as const,
            data: { artifactRequestId: item.artifactRequestId },
        })));
        await step.run("mark-generation-events-delivered", () => artifactGenerationOutboxService.markDelivered(ids));
        console.info(JSON.stringify({ event: "artifact_generation_outbox.batch_delivered", count: pending.length }));
        return { delivered: pending.length };
    },
);

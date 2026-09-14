import ChangeSetService from "../../changeset/service.js";
import { inngest } from "../client.js";

export const artifactOrchestrator = inngest.createFunction(
    {
        id: "orchestrate-artifact-generation",
        name: "artifact generation workflow",
        triggers: [
            {
                event: "github/changeset.created",
            },
        ],
    },
    async ({ event, step }) => {
        console.log("Generator workflow triggered");
        const changeSetId = event.data?.changeSetId;

        const changeSet = await step.run("fetch-changeSet", async () => {
            return ChangeSetService.fetch(changeSetId);
        });
    },
);

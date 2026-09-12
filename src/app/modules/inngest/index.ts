import ChangeSetService from "../changeset/service.js";
import GithubServices from "../github/GithubRetrievalService.js";
import { inngest } from "./client.js";

const inngestRetrieverWorkflow = inngest.createFunction(
    {
        id: "retrieve-changeset",
        name: "changeSet retrieval worflow",
        triggers: [
            {
                event: "github/push.received",
            },
        ],
    },
    async ({ event, step }) => {
        console.log("Push Event triggered");
        const { installationId, owner, repositoryName, before, after } = event.data;

        const basehead = `${before}...${after}`;

        const changeSet = await step.run("github-changes-retrieval-call", async () => {
            //Step 1 Retrieving commmit info from github

            console.log("Starting changeSet Retrieval step");

            const changeSet = await GithubServices.retrieveChangeset({
                repositoryName,
                owner,
                basehead,
                installationId,
            });

            return changeSet;
        });

        const savedChangeSet = await step.run("persist-change-set", async () => {
            // Step 2 Persisting the changeSet
            console.log("Starting changeSet persistance step");

            return ChangeSetService.persist(changeSet);
        });

        await step.sendEvent("changeset-created", {
            //Step 3 Emitting changeSet create event for generator workflow
            name: "github/changeset.created",
            data: {
                changeSetId: savedChangeSet?.id.toString(),
            },
        });
        console.log("\n+============+\n Retrieval Workflow success!");
    },
);

const inngestGeneratorWorkflow = inngest.createFunction(
    {
        id: "generate-artifact",
        name: "artifact generation workflow",
        triggers: [
            {
                event: "github/changeset.created",
            },
        ],
    },
    async ({ event, step }) => {
        console.log("Generator workflow triggered");
        const changeSetId = event.data?.id;

        const changeSet = await step.run("fetch-changeSet", async () => {
            return ChangeSetService.fetch(changeSetId);
        });
    },
);

export const functions = [inngestRetrieverWorkflow, inngestGeneratorWorkflow];

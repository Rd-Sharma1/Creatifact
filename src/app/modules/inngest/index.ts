import ChangeSetService from "../changeset/service.js";
import GithubServices from "../github/GithubRetrievalService.js";
import { inngest } from "./client.js";

const fetchGithubDetails = inngest.createFunction(
    {
        id: "fetch-detail",
        name: "github webhook details needed",
        triggers: [
            {
                event: "github/push.received",
            },
        ],
    },
    async ({ event, step }) => {
        //Step 1: get the details from event

        console.log("Push Event triggered");
        const { installationId, owner, repositoryName, before, after } = event.data;

        const basehead = `${before}...${after}`;

        const changeSet = await step.run("github-changes-retrieval-call", async () => {
            //Step 1
            console.log("Retreiving commit change info from github");

            const changeSet = await GithubServices.retrieveChangeset({
                repositoryName,
                owner,
                basehead,
                installationId,
            });
            return changeSet;
        });
        const savedChangeSet = await step.run("persist-change-set", async () => {
            return ChangeSetService.create(changeSet);
        });
        console.log("+============+\n Call Successfull");
        return savedChangeSet;
    },
);

export const functions = [fetchGithubDetails];

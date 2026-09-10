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

        const result = await step.run("github-changes-retrieval-call", async () => {
            //Step 1
            console.log("Retreiving commit change info from github");

            const changeSet = await GithubServices.compareCommits({ repositoryName, owner, basehead, installationId });
            return changeSet;
        });
        console.log("+============+\n Call Successfull");
        return result;
    },
);

export const functions = [fetchGithubDetails];

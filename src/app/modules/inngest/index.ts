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
        await step.sleep("slow-api-capp", "10s");
        const result = await step.run("github-output", () => {
            console.log("Github Output is here");
            console.log("data:", event.data);
        });
        return console.log("+============+\n Call Successfull");
    },
);

export const functions = [fetchGithubDetails];

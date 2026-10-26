import ChangeSetService from "../../changeset/service.js";
import GithubServices from "../../github/GithubRetrievalService.js";
import { resolveRepository } from "../../repository/resolve.js";
import { inngest } from "../client.js";
import { parseOrThrow } from "../../../common/validation.js";
import { changeSetCreatedEventSchema, githubPushReceivedEventSchema } from "../eventSchemas.js";
import { writeLog } from "../../../common/logger.js";

export const changeSetRetriever = inngest.createFunction(
    {
        id: "retrieve-changeset",
        name: "changeSet retrieval worflow",
        triggers: [
            {
                event: "github/push.received",
            },
        ],
    },
    async ({ event, step, runId }) => {
        const { installationId, githubRepoId, owner, repositoryName, before, after } = parseOrThrow(githubPushReceivedEventSchema, event.data);

        const basehead = `${before}...${after}`;

        const repositoryId = await step.run("resolve-repository", async () => {
            return resolveRepository({
                githubRepoId: BigInt(githubRepoId),
                owner,
                name: repositoryName,
            });
        });

        const changeSet = await step.run("github-changes-retrieval-call", async () => {
            writeLog("info", "github.changeset_retrieval.started", { workflowRunId: runId, repositoryId, githubRepoId });

            const changeSet = await GithubServices.retrieveChangeset({
                repositoryName,
                owner,
                base: before,
                head: after,
                basehead,
                installationId,
            });

            return changeSet;
        });

        const savedChangeSet = await step.run("persist-change-set", async () => {
            writeLog("info", "github.changeset_persistence.started", { workflowRunId: runId, repositoryId });

            return ChangeSetService.persist({ ...changeSet, repositoryId });
        });

        if (!savedChangeSet) throw new Error("Persisting ChangeSet returned no row");
        const createdEvent = parseOrThrow(changeSetCreatedEventSchema, { changeSetId: savedChangeSet });

        await step.sendEvent("changeset-created", {
            //Step 3 Emitting changeSet create event for generator workflow
            name: "github/changeset.created",
            data: createdEvent,
        });
        writeLog("info", "github.changeset_persistence.completed", {
            workflowRunId: runId,
            repositoryId,
            changeSetId: savedChangeSet,
        });
    },
);

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
    artifactGenerationOutboxTable,
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    repository,
} from "../../../db/schema.js";
import type { ArtifactRequest, ArtifactRequestScope, ChangeSetRole } from "../../../domain/types.js";
import { activityMapRepository, type ActivityMapReader } from "./activity/ActivityMapRepository.js";
import { artifactIntentResolver, type ArtifactIntentInterpreter } from "./intent/ArtifactIntentResolver.js";
import type { ArtifactRequestCreateInput } from "./schema.js";
import { workHistoryRetriever, type WorkHistoryRetrieverContract } from "./retrieval/WorkHistoryRetriever.js";

export type CreateArtifactRequestResult =
    | { kind: "repository-not-found" }
    | { kind: "empty-scope" }
    | { kind: "clarification-required"; clarification: string }
    | {
          kind: "created";
          request: ArtifactRequest;
          artifactTypes: ArtifactRequestCreateInput["artifactTypes"];
          scope: ArtifactRequestScope;
          targetChangeSetIds: string[];
          supportingChangeSetIds: string[];
      };

export async function createArtifactRequest(
    input: ArtifactRequestCreateInput,
    dependencies: {
        activityMap?: ActivityMapReader;
        intentResolver?: ArtifactIntentInterpreter;
        historyRetriever?: WorkHistoryRetrieverContract;
    } = {},
): Promise<CreateArtifactRequestResult> {
    const [existingRepository] = await db
        .select({ id: repository.id })
        .from(repository)
        .where(eq(repository.id, input.repositoryId));

    if (!existingRepository) return { kind: "repository-not-found" };

    const activity = await (dependencies.activityMap ?? activityMapRepository).recent(existingRepository.id);
    const intent = await (dependencies.intentResolver ?? artifactIntentResolver).interpret({
        instructions: input.instructions ?? "",
        explicitScope: input.scope,
        activity,
    });
    if (intent.clarification) {
        return { kind: "clarification-required", clarification: intent.clarification };
    }

    const resolvedChangeSets = await (dependencies.historyRetriever ?? workHistoryRetriever).resolve({
        repositoryId: existingRepository.id,
        scope: intent.scope,
        focusTerms: intent.focusTerms,
    });
    const targetChangeSets = resolvedChangeSets.filter(item => item.role === "TARGET");
    if (targetChangeSets.length === 0) return { kind: "empty-scope" };

    const createdRequest = await db.transaction(async tx => {
        const [request] = await tx
            .insert(artifactRequestTable)
            .values({
                repositoryId: existingRepository.id,
                instructions: input.instructions ?? null,
                scope: intent.scope,
                status: "PENDING",
            })
            .returning();

        if (!request) throw new Error("ArtifactRequest insert did not return a row");

        await tx.insert(artifactRequestTypeTable).values(input.artifactTypes.map(type => ({
            artifactRequestId: request.id,
            type,
        })));

        await tx.insert(artifactRequestChangeSetTable).values(resolvedChangeSets.map(({ changeSet, role }) => ({
            artifactRequestId: request.id,
            changeSetId: changeSet.id,
            role: role satisfies ChangeSetRole,
        })));

        await tx.insert(artifactGenerationOutboxTable).values({ artifactRequestId: request.id });
        return request;
    });

    return {
        kind: "created",
        request: createdRequest,
        artifactTypes: input.artifactTypes,
        scope: intent.scope,
        targetChangeSetIds: targetChangeSets.map(item => item.changeSet.id),
        supportingChangeSetIds: resolvedChangeSets.filter(item => item.role === "SUPPORTING").map(item => item.changeSet.id),
    };
}

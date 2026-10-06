import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    repository,
} from "../../../db/schema.js";
import type { ArtifactRequest } from "../../../domain/types.js";
import type { ArtifactRequestCreateInput } from "./schema.js";
import { scopeResolver } from "./scope/ScopeResolver.js";

export type CreateArtifactRequestResult =
    | { kind: "repository-not-found" }
    | { kind: "empty-scope" }
    | {
          kind: "created";
          request: ArtifactRequest;
          artifactTypes: ArtifactRequestCreateInput["artifactTypes"];
          scope: ArtifactRequestCreateInput["scope"];
          changeSetIds: string[];
      };

export async function createArtifactRequest(input: ArtifactRequestCreateInput): Promise<CreateArtifactRequestResult> {
    const [existingRepository] = await db
        .select({ id: repository.id })
        .from(repository)
        .where(eq(repository.id, input.repositoryId));

    if (!existingRepository) {
        return { kind: "repository-not-found" };
    }

    const changeSets = await scopeResolver.resolve(existingRepository.id, input.scope);
    if (changeSets.length === 0) {
        return { kind: "empty-scope" };
    }

    const createdRequest = await db.transaction(async tx => {
        const [request] = await tx
            .insert(artifactRequestTable)
            .values({
                repositoryId: existingRepository.id,
                instructions: input.instructions ?? null,
                status: "PENDING",
            })
            .returning();

        if (!request) {
            throw new Error("ArtifactRequest insert did not return a row");
        }

        await tx.insert(artifactRequestTypeTable).values(
            input.artifactTypes.map(type => ({
                artifactRequestId: request.id,
                type,
            })),
        );

        await tx.insert(artifactRequestChangeSetTable).values(
            changeSets.map(changeSet => ({
                artifactRequestId: request.id,
                changeSetId: changeSet.id,
            })),
        );

        return request;
    });

    return {
        kind: "created",
        request: createdRequest,
        artifactTypes: input.artifactTypes,
        scope: input.scope,
        changeSetIds: changeSets.map(changeSet => changeSet.id),
    };
}

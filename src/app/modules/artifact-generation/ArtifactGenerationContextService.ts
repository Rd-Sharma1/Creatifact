import { asc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    changeSetTable,
    repository,
} from "../../../db/schema.js";
import type { ArtifactGenerationContext, ArtifactRequest, ArtifactType, ChangeSet } from "../../../domain/types.js";

export interface ArtifactGenerationContextReader {
    getArtifactRequest(
        artifactRequestId: string,
    ): Promise<Pick<ArtifactRequest, "id" | "repositoryId" | "instructions"> | undefined>;
    getRepository(repositoryId: string): Promise<ArtifactGenerationContext["repository"] | undefined>;
    getRequestedArtifactTypes(artifactRequestId: string): Promise<ArtifactType[]>;
    getLinkedChangeSets(artifactRequestId: string): Promise<ChangeSet[]>;
}

export class ArtifactRequestNotFoundError extends Error {
    constructor(artifactRequestId: string) {
        super(`ArtifactRequest not found: ${artifactRequestId}`);
        this.name = "ArtifactRequestNotFoundError";
    }
}

export class ArtifactGenerationRepositoryNotFoundError extends Error {
    constructor(repositoryId: string) {
        super(`Repository not found for ArtifactRequest: ${repositoryId}`);
        this.name = "ArtifactGenerationRepositoryNotFoundError";
    }
}

class DrizzleArtifactGenerationContextReader implements ArtifactGenerationContextReader {
    async getArtifactRequest(
        artifactRequestId: string,
    ): Promise<Pick<ArtifactRequest, "id" | "repositoryId" | "instructions"> | undefined> {
        const [request] = await db
            .select({
                id: artifactRequestTable.id,
                repositoryId: artifactRequestTable.repositoryId,
                instructions: artifactRequestTable.instructions,
            })
            .from(artifactRequestTable)
            .where(eq(artifactRequestTable.id, artifactRequestId));
        return request;
    }

    async getRepository(repositoryId: string): Promise<ArtifactGenerationContext["repository"] | undefined> {
        const [repo] = await db
            .select({ id: repository.id, owner: repository.owner, name: repository.name })
            .from(repository)
            .where(eq(repository.id, repositoryId));
        return repo;
    }

    async getRequestedArtifactTypes(artifactRequestId: string): Promise<ArtifactType[]> {
        const rows = await db
            .select({ type: artifactRequestTypeTable.type })
            .from(artifactRequestTypeTable)
            .where(eq(artifactRequestTypeTable.artifactRequestId, artifactRequestId));
        return rows.map(row => row.type);
    }

    async getLinkedChangeSets(artifactRequestId: string): Promise<ChangeSet[]> {
        const rows = await db
            .select({ changeSet: changeSetTable })
            .from(artifactRequestChangeSetTable)
            .innerJoin(changeSetTable, eq(artifactRequestChangeSetTable.changeSetId, changeSetTable.id))
            .where(eq(artifactRequestChangeSetTable.artifactRequestId, artifactRequestId))
            .orderBy(asc(changeSetTable.createdAt), asc(changeSetTable.id));
        return rows.map(row => row.changeSet);
    }
}

export class ArtifactGenerationContextService {
    constructor(private readonly reader: ArtifactGenerationContextReader = new DrizzleArtifactGenerationContextReader()) {}

    async build(artifactRequestId: string): Promise<ArtifactGenerationContext> {
        const request = await this.reader.getArtifactRequest(artifactRequestId);
        if (!request) {
            throw new ArtifactRequestNotFoundError(artifactRequestId);
        }

        const [repo, requestedArtifactTypes, changeSets] = await Promise.all([
            this.reader.getRepository(request.repositoryId),
            this.reader.getRequestedArtifactTypes(artifactRequestId),
            this.reader.getLinkedChangeSets(artifactRequestId),
        ]);

        if (!repo) {
            throw new ArtifactGenerationRepositoryNotFoundError(request.repositoryId);
        }

        return {
            artifactRequest: { id: request.id, instructions: request.instructions },
            repository: repo,
            requestedArtifactTypes,
            changeSets,
        };
    }
}

export const artifactGenerationContextService = new ArtifactGenerationContextService();

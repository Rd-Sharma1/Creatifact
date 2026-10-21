import { asc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    changeSetTable,
    repository,
} from "../../../db/schema.js";
import type { ArtifactGenerationChangeSet, ArtifactGenerationContext, ArtifactRequest, ArtifactType } from "../../../domain/types.js";
import { NotFoundError } from "../../common/errors.js";
import { evidenceBuilder, EvidenceBuilder } from "./EvidenceBuilder.js";

export interface ArtifactGenerationContextReader {
    getArtifactRequest(
        artifactRequestId: string,
    ): Promise<Pick<ArtifactRequest, "id" | "repositoryId" | "instructions" | "scope"> | undefined>;
    getRepository(repositoryId: string): Promise<ArtifactGenerationContext["repository"] | undefined>;
    getRequestedArtifactTypes(artifactRequestId: string): Promise<ArtifactType[]>;
    getLinkedChangeSets(artifactRequestId: string): Promise<ArtifactGenerationChangeSet[]>;
}

export class ArtifactRequestNotFoundError extends NotFoundError {
    constructor(_artifactRequestId: string) {
        super("ArtifactRequest not found");
    }
}

export class ArtifactGenerationRepositoryNotFoundError extends NotFoundError {
    constructor(_repositoryId: string) {
        super("Repository not found for ArtifactRequest");
    }
}

class DrizzleArtifactGenerationContextReader implements ArtifactGenerationContextReader {
    async getArtifactRequest(
        artifactRequestId: string,
    ): Promise<Pick<ArtifactRequest, "id" | "repositoryId" | "instructions" | "scope"> | undefined> {
        const [request] = await db
            .select({
                id: artifactRequestTable.id,
                repositoryId: artifactRequestTable.repositoryId,
                instructions: artifactRequestTable.instructions,
                scope: artifactRequestTable.scope,
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

    async getLinkedChangeSets(artifactRequestId: string): Promise<ArtifactGenerationChangeSet[]> {
        const rows = await db
            .select({ changeSet: changeSetTable, role: artifactRequestChangeSetTable.role })
            .from(artifactRequestChangeSetTable)
            .innerJoin(changeSetTable, eq(artifactRequestChangeSetTable.changeSetId, changeSetTable.id))
            .where(eq(artifactRequestChangeSetTable.artifactRequestId, artifactRequestId))
            .orderBy(asc(changeSetTable.createdAt), asc(changeSetTable.id));
        return rows.map(row => ({ changeSet: row.changeSet, role: row.role }));
    }
}

export class ArtifactGenerationContextService {
    constructor(
        private readonly reader: ArtifactGenerationContextReader = new DrizzleArtifactGenerationContextReader(),
        private readonly buildEvidence: Pick<EvidenceBuilder, "build"> = evidenceBuilder,
    ) {}

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
            artifactRequest: { id: request.id, instructions: request.instructions, scope: request.scope },
            repository: repo,
            requestedArtifactTypes,
            changeSets,
            evidence: this.buildEvidence.build(changeSets),
        };
    }
}

export const artifactGenerationContextService = new ArtifactGenerationContextService();

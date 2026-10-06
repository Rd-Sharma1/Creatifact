import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { artifactRequestTable, artifactTable } from "../../../db/schema.js";
import type { Artifact, ArtifactRequestStatus, ArtifactType, GeneratedArtifactResult } from "../../../domain/types.js";

export type PersistedArtifactResult = {
    artifact: Artifact;
    created: boolean;
};

export interface ArtifactGenerationPersistence {
    markGenerating(artifactRequestId: string): Promise<ArtifactRequestStatus>;
    markCompleted(artifactRequestId: string): Promise<void>;
    markFailed(artifactRequestId: string): Promise<void>;
    findArtifact(artifactRequestId: string, type: ArtifactType): Promise<Artifact | undefined>;
    persistIfAbsent(artifactRequestId: string, result: GeneratedArtifactResult): Promise<PersistedArtifactResult>;
}

export class ArtifactGenerationPersistenceService implements ArtifactGenerationPersistence {
    async markGenerating(artifactRequestId: string): Promise<ArtifactRequestStatus> {
        const [updated] = await db
            .update(artifactRequestTable)
            .set({ status: "GENERATING", updatedAt: new Date() })
            .where(
                and(
                    eq(artifactRequestTable.id, artifactRequestId),
                    eq(artifactRequestTable.status, "PENDING"),
                ),
            )
            .returning({ status: artifactRequestTable.status });

        if (updated) {
            return updated.status;
        }

        const [current] = await db
            .select({ status: artifactRequestTable.status })
            .from(artifactRequestTable)
            .where(eq(artifactRequestTable.id, artifactRequestId));
        if (!current) {
            throw new Error(`ArtifactRequest not found: ${artifactRequestId}`);
        }
        return current.status;
    }

    async markCompleted(artifactRequestId: string): Promise<void> {
        const [updated] = await db
            .update(artifactRequestTable)
            .set({ status: "COMPLETED", updatedAt: new Date() })
            .where(
                and(
                    eq(artifactRequestTable.id, artifactRequestId),
                    eq(artifactRequestTable.status, "GENERATING"),
                ),
            )
            .returning({ id: artifactRequestTable.id });

        if (!updated) {
            const [current] = await db
                .select({ status: artifactRequestTable.status })
                .from(artifactRequestTable)
                .where(eq(artifactRequestTable.id, artifactRequestId));
            if (!current || current.status !== "COMPLETED") {
                throw new Error(`Cannot mark ArtifactRequest ${artifactRequestId} completed`);
            }
        }
    }

    async markFailed(artifactRequestId: string): Promise<void> {
        const [updated] = await db
            .update(artifactRequestTable)
            .set({ status: "FAILED", updatedAt: new Date() })
            .where(
                and(
                    eq(artifactRequestTable.id, artifactRequestId),
                    inArray(artifactRequestTable.status, ["PENDING", "GENERATING", "FAILED"]),
                ),
            )
            .returning({ id: artifactRequestTable.id });

        if (!updated) {
            const [current] = await db
                .select({ status: artifactRequestTable.status })
                .from(artifactRequestTable)
                .where(eq(artifactRequestTable.id, artifactRequestId));
            if (!current) {
                throw new Error(`ArtifactRequest not found: ${artifactRequestId}`);
            }
        }
    }

    async findArtifact(artifactRequestId: string, type: ArtifactType): Promise<Artifact | undefined> {
        const [artifact] = await db
            .select()
            .from(artifactTable)
            .where(and(eq(artifactTable.artifactRequestId, artifactRequestId), eq(artifactTable.type, type)));
        return artifact;
    }

    async persistIfAbsent(artifactRequestId: string, result: GeneratedArtifactResult): Promise<PersistedArtifactResult> {
        const [created] = await db
            .insert(artifactTable)
            .values({
                artifactRequestId,
                type: result.type,
                content: result.content,
            })
            .onConflictDoNothing({ target: [artifactTable.artifactRequestId, artifactTable.type] })
            .returning();

        if (created) {
            return { artifact: created, created: true };
        }

        const existing = await this.findArtifact(artifactRequestId, result.type);
        if (!existing) {
            throw new Error(`Artifact insert conflicted but no existing ${result.type} Artifact was found`);
        }
        return { artifact: existing, created: false };
    }
}

export const artifactGenerationPersistence = new ArtifactGenerationPersistenceService();

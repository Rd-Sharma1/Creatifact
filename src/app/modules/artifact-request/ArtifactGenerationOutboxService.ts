import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { artifactGenerationOutboxTable } from "../../../db/schema.js";

export type PendingGenerationEvent = { id: string; artifactRequestId: string };

export interface ArtifactGenerationOutboxStore {
    pending(limit?: number): Promise<PendingGenerationEvent[]>;
    recordAttempt(ids: string[]): Promise<void>;
    markDelivered(ids: string[]): Promise<void>;
}

export class ArtifactGenerationOutboxService implements ArtifactGenerationOutboxStore {
    constructor(private readonly database: typeof db = db) {}

    async pending(limit = 50): Promise<PendingGenerationEvent[]> {
        return this.database.select({ id: artifactGenerationOutboxTable.id, artifactRequestId: artifactGenerationOutboxTable.artifactRequestId })
            .from(artifactGenerationOutboxTable)
            .where(sql`${artifactGenerationOutboxTable.deliveredAt} is null`)
            .orderBy(asc(artifactGenerationOutboxTable.createdAt), asc(artifactGenerationOutboxTable.id))
            .limit(limit);
    }

    async recordAttempt(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.database.update(artifactGenerationOutboxTable)
            .set({ attempts: sql`${artifactGenerationOutboxTable.attempts} + 1` })
            .where(and(inArray(artifactGenerationOutboxTable.id, ids), sql`${artifactGenerationOutboxTable.deliveredAt} is null`));
    }

    async markDelivered(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.database.update(artifactGenerationOutboxTable)
            .set({ deliveredAt: new Date() })
            .where(and(inArray(artifactGenerationOutboxTable.id, ids), sql`${artifactGenerationOutboxTable.deliveredAt} is null`));
    }
}

export const artifactGenerationOutboxService = new ArtifactGenerationOutboxService();

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { artifactCandidateTable, artifactRequestTable } from "../../../db/schema.js";
import type { ArtifactCandidate, ArtifactRequestStatus, ArtifactType, GeneratedArtifactCandidates } from "../../../domain/types.js";
import { ConflictError, DomainValidationError, NotFoundError } from "../../common/errors.js";

export interface ArtifactGenerationPersistence {
    markGenerating(artifactRequestId: string): Promise<ArtifactRequestStatus>;
    markCompleted(artifactRequestId: string): Promise<void>;
    markFailed(artifactRequestId: string): Promise<void>;
    findCandidates(artifactRequestId: string, type: ArtifactType): Promise<ArtifactCandidate[]>;
    persistCandidatesIfAbsent(artifactRequestId: string, result: GeneratedArtifactCandidates): Promise<ArtifactCandidate[]>;
}

export class ArtifactGenerationPersistenceService implements ArtifactGenerationPersistence {
    async markGenerating(artifactRequestId: string): Promise<ArtifactRequestStatus> {
        const [updated] = await db.update(artifactRequestTable)
            .set({ status: "GENERATING", updatedAt: new Date() })
            .where(and(eq(artifactRequestTable.id, artifactRequestId), eq(artifactRequestTable.status, "PENDING")))
            .returning({ status: artifactRequestTable.status });
        if (updated) return updated.status;

        const [current] = await db.select({ status: artifactRequestTable.status })
            .from(artifactRequestTable).where(eq(artifactRequestTable.id, artifactRequestId));
        if (!current) throw new NotFoundError("ArtifactRequest not found");
        return current.status;
    }

    async markCompleted(artifactRequestId: string): Promise<void> {
        const [updated] = await db.update(artifactRequestTable)
            .set({ status: "COMPLETED", updatedAt: new Date() })
            .where(and(eq(artifactRequestTable.id, artifactRequestId), eq(artifactRequestTable.status, "GENERATING")))
            .returning({ id: artifactRequestTable.id });
        if (updated) return;

        const [current] = await db.select({ status: artifactRequestTable.status })
            .from(artifactRequestTable).where(eq(artifactRequestTable.id, artifactRequestId));
        if (!current) throw new NotFoundError("ArtifactRequest not found");
        if (current.status !== "COMPLETED") throw new ConflictError("ArtifactRequest cannot be marked completed from its current state");
    }

    async markFailed(artifactRequestId: string): Promise<void> {
        const [updated] = await db.update(artifactRequestTable)
            .set({ status: "FAILED", updatedAt: new Date() })
            .where(and(
                eq(artifactRequestTable.id, artifactRequestId),
                inArray(artifactRequestTable.status, ["PENDING", "GENERATING", "FAILED"]),
            ))
            .returning({ id: artifactRequestTable.id });
        if (updated) return;

        const [current] = await db.select({ status: artifactRequestTable.status })
            .from(artifactRequestTable).where(eq(artifactRequestTable.id, artifactRequestId));
        if (!current) throw new NotFoundError("ArtifactRequest not found");
    }

    async findCandidates(artifactRequestId: string, type: ArtifactType): Promise<ArtifactCandidate[]> {
        return db.select().from(artifactCandidateTable)
            .where(and(eq(artifactCandidateTable.artifactRequestId, artifactRequestId), eq(artifactCandidateTable.type, type)))
            .orderBy(asc(artifactCandidateTable.ordinal));
    }

    async persistCandidatesIfAbsent(artifactRequestId: string, result: GeneratedArtifactCandidates): Promise<ArtifactCandidate[]> {
        if (result.candidates.length < 1 || result.candidates.length > 2) {
            throw new DomainValidationError("INVALID_CANDIDATE_COUNT", "Artifact generation must return one or two candidates");
        }

        return db.transaction(async tx => {
            await tx.insert(artifactCandidateTable).values(result.candidates.map((candidate, ordinal) => ({
                artifactRequestId,
                type: result.type,
                ordinal,
                angle: candidate.angle,
                content: candidate.content,
                evidence: candidate.claims.flatMap(claim => claim.evidence.map(reference => ({
                    claim: claim.claim,
                    changeSetId: reference.changeSetId,
                    quote: reference.quote,
                }))),
                status: "READY" as const,
            }))).onConflictDoNothing({
                target: [artifactCandidateTable.artifactRequestId, artifactCandidateTable.type, artifactCandidateTable.ordinal],
            });

            const candidates = await tx.select().from(artifactCandidateTable)
                .where(and(
                    eq(artifactCandidateTable.artifactRequestId, artifactRequestId),
                    eq(artifactCandidateTable.type, result.type),
                ))
                .orderBy(asc(artifactCandidateTable.ordinal));
            if (candidates.length === 0) throw new Error(`Could not persist candidates for ${result.type}`);
            return candidates;
        });
    }
}

export const artifactGenerationPersistence = new ArtifactGenerationPersistenceService();

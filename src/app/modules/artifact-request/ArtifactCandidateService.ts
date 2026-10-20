import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import type { GenerationCandidateInput } from "../../../domain/types.js";
import {
    artifactCandidateTable,
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    artifactTable,
} from "../../../db/schema.js";
import { artifactGenerationContextService } from "../artifact-generation/ArtifactGenerationContextService.js";
import { CandidateValidationError, candidateValidator } from "../artifact-generation/CandidateValidator.js";

export type CandidateActionResult =
    | { kind: "not-found" }
    | { kind: "conflict"; message: string }
    | { kind: "updated"; candidateId: string }
    | { kind: "selected"; artifact: typeof artifactTable.$inferSelect };

export async function getArtifactRequestDetails(artifactRequestId: string) {
    const [request] = await db.select().from(artifactRequestTable).where(eq(artifactRequestTable.id, artifactRequestId));
    if (!request) return undefined;

    const [types, changeSets, candidates, artifacts] = await Promise.all([
        db.select({ type: artifactRequestTypeTable.type }).from(artifactRequestTypeTable)
            .where(eq(artifactRequestTypeTable.artifactRequestId, artifactRequestId)),
        db.select({ changeSetId: artifactRequestChangeSetTable.changeSetId, role: artifactRequestChangeSetTable.role })
            .from(artifactRequestChangeSetTable).where(eq(artifactRequestChangeSetTable.artifactRequestId, artifactRequestId)),
        db.select().from(artifactCandidateTable).where(eq(artifactCandidateTable.artifactRequestId, artifactRequestId))
            .orderBy(artifactCandidateTable.type, artifactCandidateTable.ordinal),
        db.select().from(artifactTable).where(eq(artifactTable.artifactRequestId, artifactRequestId)),
    ]);
    return {
        ...request,
        artifactTypes: types.map(item => item.type),
        changeSets: changeSets.map(item => ({ id: item.changeSetId, role: item.role })),
        candidates,
        artifacts,
    };
}

async function lockRequest(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], artifactRequestId: string) {
    const [request] = await tx.select({ id: artifactRequestTable.id, status: artifactRequestTable.status })
        .from(artifactRequestTable).where(eq(artifactRequestTable.id, artifactRequestId)).for("update");
    return request;
}

export async function editArtifactCandidate(input: {
    artifactRequestId: string;
    candidateId: string;
    content: string;
}): Promise<CandidateActionResult> {
    const [initialCandidate] = await db.select().from(artifactCandidateTable)
        .where(and(
            eq(artifactCandidateTable.id, input.candidateId),
            eq(artifactCandidateTable.artifactRequestId, input.artifactRequestId),
        ));
    if (!initialCandidate) return { kind: "not-found" };

    const [initialRequest] = await db.select({ status: artifactRequestTable.status })
        .from(artifactRequestTable).where(eq(artifactRequestTable.id, input.artifactRequestId));
    if (!initialRequest) return { kind: "not-found" };
    if (initialRequest.status !== "COMPLETED" && initialRequest.status !== "FAILED") {
        return { kind: "conflict", message: "Candidates can only be edited after generation ends" };
    }
    if (initialCandidate.status !== "READY") {
        return { kind: "conflict", message: "Only unselected candidates can be edited" };
    }

    const [existingArtifact] = await db.select({ id: artifactTable.id }).from(artifactTable)
        .where(and(
            eq(artifactTable.artifactRequestId, input.artifactRequestId),
            eq(artifactTable.type, initialCandidate.type),
        ));
    if (existingArtifact) return { kind: "conflict", message: "This artifact type has already been selected" };

    const context = await artifactGenerationContextService.build(input.artifactRequestId);
    const claimsByText = new Map<string, Array<{ changeSetId: string; quote: string }>>();
    for (const reference of initialCandidate.evidence) {
        const references = claimsByText.get(reference.claim) ?? [];
        references.push({ changeSetId: reference.changeSetId, quote: reference.quote });
        claimsByText.set(reference.claim, references);
    }
    const candidate: GenerationCandidateInput = {
        angle: initialCandidate.angle,
        content: input.content,
        claims: [...claimsByText].map(([claim, evidence]) => ({ claim, evidence })),
    };
    await candidateValidator.validate({
        type: initialCandidate.type,
        instructions: context.artifactRequest.instructions,
        candidate,
        evidence: context.evidence,
    });

    return db.transaction(async tx => {
        const request = await lockRequest(tx, input.artifactRequestId);
        if (!request) return { kind: "not-found" };
        if (request.status !== "COMPLETED" && request.status !== "FAILED") return { kind: "conflict", message: "Candidates can only be edited after generation ends" };

        const [candidate] = await tx.select().from(artifactCandidateTable)
            .where(and(
                eq(artifactCandidateTable.id, input.candidateId),
                eq(artifactCandidateTable.artifactRequestId, input.artifactRequestId),
            )).for("update");
        if (!candidate) return { kind: "not-found" };
        if (candidate.status !== "READY") return { kind: "conflict", message: "Only unselected candidates can be edited" };
        if (candidate.updatedAt.getTime() !== initialCandidate.updatedAt.getTime() || candidate.content !== initialCandidate.content) {
            return { kind: "conflict", message: "Candidate changed while validation was running; reload and try again" };
        }
        const limit = candidate.type === "X_POST" ? 280 : 3000;
        if (Array.from(input.content).length > limit) {
            return { kind: "conflict", message: `${candidate.type} content cannot exceed ${limit} characters` };
        }

        const [artifact] = await tx.select({ id: artifactTable.id }).from(artifactTable)
            .where(and(eq(artifactTable.artifactRequestId, input.artifactRequestId), eq(artifactTable.type, candidate.type)));
        if (artifact) return { kind: "conflict", message: "This artifact type has already been selected" };

        await tx.update(artifactCandidateTable).set({ content: input.content, updatedAt: new Date() })
            .where(eq(artifactCandidateTable.id, candidate.id));
        return { kind: "updated", candidateId: candidate.id };
    });
}

export async function discardArtifactCandidate(input: {
    artifactRequestId: string;
    candidateId: string;
}): Promise<CandidateActionResult> {
    return db.transaction(async tx => {
        const request = await lockRequest(tx, input.artifactRequestId);
        if (!request) return { kind: "not-found" };
        if (request.status !== "COMPLETED" && request.status !== "FAILED") return { kind: "conflict", message: "Candidates can only be discarded after generation ends" };

        const [candidate] = await tx.select().from(artifactCandidateTable)
            .where(and(
                eq(artifactCandidateTable.id, input.candidateId),
                eq(artifactCandidateTable.artifactRequestId, input.artifactRequestId),
            )).for("update");
        if (!candidate) return { kind: "not-found" };
        if (candidate.status !== "READY") return { kind: "conflict", message: "Only unselected candidates can be discarded" };

        await tx.update(artifactCandidateTable).set({ status: "DISCARDED", updatedAt: new Date() })
            .where(eq(artifactCandidateTable.id, candidate.id));
        return { kind: "updated", candidateId: candidate.id };
    });
}

export async function selectArtifactCandidate(input: {
    artifactRequestId: string;
    candidateId: string;
}): Promise<CandidateActionResult> {
    return db.transaction(async tx => {
        const request = await lockRequest(tx, input.artifactRequestId);
        if (!request) return { kind: "not-found" };
        if (request.status !== "COMPLETED" && request.status !== "FAILED") return { kind: "conflict", message: "Candidates can only be selected after generation ends" };

        const [candidate] = await tx.select().from(artifactCandidateTable)
            .where(and(
                eq(artifactCandidateTable.id, input.candidateId),
                eq(artifactCandidateTable.artifactRequestId, input.artifactRequestId),
            )).for("update");
        if (!candidate) return { kind: "not-found" };

        const [existing] = await tx.select().from(artifactTable)
            .where(and(eq(artifactTable.artifactRequestId, input.artifactRequestId), eq(artifactTable.type, candidate.type)));
        if (existing) {
            if (candidate.status === "SELECTED") return { kind: "selected", artifact: existing };
            return { kind: "conflict", message: "A different candidate has already been selected for this type" };
        }
        if (candidate.status !== "READY") return { kind: "conflict", message: "Discarded candidates cannot be selected" };

        const [artifact] = await tx.insert(artifactTable).values({
            artifactRequestId: input.artifactRequestId,
            type: candidate.type,
            content: candidate.content,
        }).onConflictDoNothing({ target: [artifactTable.artifactRequestId, artifactTable.type] }).returning();
        if (!artifact) {
            const [raced] = await tx.select().from(artifactTable)
                .where(and(eq(artifactTable.artifactRequestId, input.artifactRequestId), eq(artifactTable.type, candidate.type)));
            const [selectedCandidate] = await tx.select({ id: artifactCandidateTable.id })
                .from(artifactCandidateTable).where(and(
                    eq(artifactCandidateTable.artifactRequestId, input.artifactRequestId),
                    eq(artifactCandidateTable.type, candidate.type),
                    eq(artifactCandidateTable.status, "SELECTED"),
                ));
            if (raced && selectedCandidate?.id === candidate.id) return { kind: "selected", artifact: raced };
            return { kind: "conflict", message: "A different candidate has already been selected for this type" };
        }

        await tx.update(artifactCandidateTable).set({ status: "SELECTED", updatedAt: new Date() })
            .where(eq(artifactCandidateTable.id, candidate.id));
        return { kind: "selected", artifact };
    });
}

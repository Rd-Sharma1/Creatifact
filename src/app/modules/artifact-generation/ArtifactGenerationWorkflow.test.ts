import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
    ArtifactCandidate,
    ArtifactGenerationContext,
    ArtifactRequestStatus,
    ArtifactType,
    GeneratedArtifactCandidates,
} from "../../../domain/types.js";
import type { ArtifactGenerationPersistence } from "./ArtifactGenerationPersistenceService.js";
import { ArtifactTypesGenerationFailedError, ArtifactGenerationWorkflowService } from "./ArtifactGenerationWorkflowService.js";

const requestId = "request-id";
const context: ArtifactGenerationContext = {
    artifactRequest: { id: requestId, instructions: "Highlight the authentication work.", scope: { type: "TODAY" } },
    repository: { id: "repository-id", owner: "example", name: "project" },
    requestedArtifactTypes: ["X_POST", "LINKEDIN_POST"],
    changeSets: [],
    evidence: [],
};

class MemoryGenerationPersistence implements ArtifactGenerationPersistence {
    status: ArtifactRequestStatus = "PENDING";
    readonly candidates = new Map<ArtifactType, ArtifactCandidate[]>();

    async markGenerating(): Promise<ArtifactRequestStatus> {
        if (this.status === "PENDING") this.status = "GENERATING";
        return this.status;
    }

    async markCompleted(): Promise<void> {
        assert.equal(this.status, "GENERATING");
        this.status = "COMPLETED";
    }

    async markFailed(): Promise<void> {
        if (this.status !== "COMPLETED") this.status = "FAILED";
    }

    async findCandidates(_id: string, type: ArtifactType): Promise<ArtifactCandidate[]> {
        return this.candidates.get(type) ?? [];
    }

    async persistCandidatesIfAbsent(_id: string, result: GeneratedArtifactCandidates): Promise<ArtifactCandidate[]> {
        const existing = this.candidates.get(result.type);
        if (existing?.length) return existing;
        const rows = result.candidates.map((candidate, ordinal) => ({
            id: `${result.type}-${ordinal}`,
            artifactRequestId: requestId,
            type: result.type,
            ordinal,
            angle: candidate.angle,
            content: candidate.content,
            evidence: candidate.claims.flatMap(claim => claim.evidence.map(reference => ({ claim: claim.claim, ...reference }))),
            status: "READY" as const,
            createdAt: new Date("2026-10-12T12:00:00.000Z"),
            updatedAt: new Date("2026-10-12T12:00:00.000Z"),
        }));
        this.candidates.set(result.type, rows);
        return rows;
    }
}

class RacingGenerationPersistence extends MemoryGenerationPersistence {
    async persistCandidatesIfAbsent(_id: string, result: GeneratedArtifactCandidates): Promise<ArtifactCandidate[]> {
        const row: ArtifactCandidate = {
            id: `concurrent-${result.type}`,
            artifactRequestId: requestId,
            type: result.type,
            ordinal: 0,
            angle: "Concurrent candidate",
            content: "Persisted by a concurrent delivery",
            evidence: [],
            status: "READY",
            createdAt: new Date("2026-10-12T12:00:00.000Z"),
            updatedAt: new Date("2026-10-12T12:00:00.000Z"),
        };
        this.candidates.set(result.type, [row]);
        return [row];
    }
}

function makeWorkflow(
    persistence: MemoryGenerationPersistence,
    generate: (type: ArtifactType) => Promise<GeneratedArtifactCandidates["candidates"]>,
    requestedTypes: ArtifactType[] = context.requestedArtifactTypes,
) {
    const calls = new Map<ArtifactType, number>();
    const generationContext = { ...context, requestedArtifactTypes: requestedTypes };
    const workflow = new ArtifactGenerationWorkflowService(
        { build: async () => generationContext },
        {
            async generateType(_generationContext, type) {
                calls.set(type, (calls.get(type) ?? 0) + 1);
                return { type, candidates: await generate(type) };
            },
        },
        persistence,
    );
    return { workflow, calls };
}

const oneCandidate = (content: string) => [{ angle: "Authentication changes", content, claims: [{ claim: content, evidence: [] }] }];

describe("ArtifactGenerationWorkflowService", () => {
    it("generates and persists candidate sets for each requested type, then completes", async () => {
        const persistence = new MemoryGenerationPersistence();
        const { workflow } = makeWorkflow(persistence, async type => oneCandidate(`${type} candidate`));

        const outcomes = await workflow.run(requestId);

        assert.deepEqual(outcomes.map(item => item.type), ["X_POST", "LINKEDIN_POST"]);
        assert.equal(persistence.candidates.size, 2);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("skips a type whose candidates already exist", async () => {
        const persistence = new MemoryGenerationPersistence();
        persistence.candidates.set("X_POST", [{
            id: "existing-x", artifactRequestId: requestId, type: "X_POST", ordinal: 0,
            angle: "Existing", content: "Existing candidate", evidence: [], status: "READY",
            createdAt: new Date(), updatedAt: new Date(),
        }]);
        const { workflow, calls } = makeWorkflow(persistence, async type => oneCandidate(`${type} candidate`));

        await workflow.run(requestId);

        assert.equal(calls.get("X_POST") ?? 0, 0);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("treats completed request delivery as a no-op", async () => {
        const persistence = new MemoryGenerationPersistence();
        persistence.status = "COMPLETED";
        const { workflow, calls } = makeWorkflow(persistence, async type => oneCandidate(`${type} candidate`));

        assert.deepEqual(await workflow.run(requestId), []);
        assert.equal(calls.size, 0);
    });

    it("keeps the candidate set returned by a concurrent insert without adding duplicates", async () => {
        const persistence = new RacingGenerationPersistence();
        const { workflow, calls } = makeWorkflow(persistence, async type => oneCandidate(`${type} candidate`), ["X_POST"]);

        await workflow.run(requestId);

        assert.equal(calls.get("X_POST"), 1);
        assert.equal(persistence.candidates.get("X_POST")?.length, 1);
        assert.equal(persistence.candidates.get("X_POST")?.[0]?.id, "concurrent-X_POST");
    });

    it("preserves success for one type when another fails and completes on retry without regenerating it", async () => {
        const persistence = new MemoryGenerationPersistence();
        let linkedinAttempts = 0;
        const { workflow, calls } = makeWorkflow(persistence, async type => {
            if (type === "LINKEDIN_POST" && linkedinAttempts++ === 0) throw new Error("temporary failure");
            return oneCandidate(`${type} candidate`);
        });

        await assert.rejects(workflow.run(requestId), ArtifactTypesGenerationFailedError);
        assert.equal(persistence.candidates.has("X_POST"), true);
        assert.equal(persistence.status, "GENERATING");

        await workflow.run(requestId);
        assert.equal(calls.get("X_POST"), 1);
        assert.equal(calls.get("LINKEDIN_POST"), 2);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("marks the request FAILED only from the terminal failure handler", async () => {
        const persistence = new MemoryGenerationPersistence();
        const { workflow } = makeWorkflow(persistence, async () => { throw new Error("provider unavailable"); }, ["X_POST"]);

        await assert.rejects(workflow.run(requestId), ArtifactTypesGenerationFailedError);
        assert.equal(persistence.status, "GENERATING");
        await workflow.markFailed(requestId);
        assert.equal(persistence.status, "FAILED");
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArtifactGenerationContext, Artifact, ArtifactRequestStatus, ArtifactType, GeneratedArtifactResult } from "../../../domain/types.js";
import type { ArtifactGenerationPersistence, PersistedArtifactResult } from "./ArtifactGenerationPersistenceService.js";
import { ArtifactTypesGenerationFailedError, ArtifactGenerationWorkflowService } from "./ArtifactGenerationWorkflowService.js";

const artifactRequestId = "request-id";
const context: ArtifactGenerationContext = {
    artifactRequest: { id: artifactRequestId, instructions: "Highlight user impact." },
    repository: { id: "repository-id", owner: "example", name: "project" },
    requestedArtifactTypes: ["X_POST", "LINKEDIN_POST"],
    changeSets: [],
};

class MemoryGenerationPersistence implements ArtifactGenerationPersistence {
    status: ArtifactRequestStatus = "PENDING";
    readonly artifacts = new Map<ArtifactType, Artifact>();

    async markGenerating(): Promise<ArtifactRequestStatus> {
        if (this.status === "PENDING") {
            this.status = "GENERATING";
        }
        return this.status;
    }

    async markCompleted(): Promise<void> {
        assert.equal(this.status, "GENERATING");
        this.status = "COMPLETED";
    }

    async markFailed(): Promise<void> {
        if (this.status !== "COMPLETED") {
            this.status = "FAILED";
        }
    }

    async findArtifact(_requestId: string, type: ArtifactType): Promise<Artifact | undefined> {
        return this.artifacts.get(type);
    }

    async persistIfAbsent(_requestId: string, result: GeneratedArtifactResult): Promise<PersistedArtifactResult> {
        const existing = this.artifacts.get(result.type);
        if (existing) {
            return { artifact: existing, created: false };
        }
        const artifact: Artifact = {
            id: `artifact-${result.type}`,
            artifactRequestId,
            type: result.type,
            content: result.content,
            createdAt: new Date("2026-10-06T12:00:00.000Z"),
        };
        this.artifacts.set(result.type, artifact);
        return { artifact, created: true };
    }
}

class RacingGenerationPersistence extends MemoryGenerationPersistence {
    async persistIfAbsent(_requestId: string, result: GeneratedArtifactResult): Promise<PersistedArtifactResult> {
        const artifact: Artifact = {
            id: `concurrent-${result.type}`,
            artifactRequestId,
            type: result.type,
            content: "Persisted by a concurrent delivery",
            createdAt: new Date("2026-10-06T12:00:00.000Z"),
        };
        this.artifacts.set(result.type, artifact);
        return { artifact, created: false };
    }
}

function makeWorkflow(
    persistence: MemoryGenerationPersistence,
    generate: (type: ArtifactType) => Promise<string>,
    requestedTypes: ArtifactType[] = context.requestedArtifactTypes,
) {
    const calls = new Map<ArtifactType, number>();
    const generationContext = { ...context, requestedArtifactTypes: requestedTypes };
    const workflow = new ArtifactGenerationWorkflowService(
        { build: async () => generationContext },
        {
            async generateType(_generationContext, type) {
                calls.set(type, (calls.get(type) ?? 0) + 1);
                return { type, content: await generate(type) };
            },
        },
        persistence,
    );
    return { workflow, calls };
}

describe("ArtifactGenerationWorkflowService", () => {
    it("generates and persists all requested artifact types, then completes the request", async () => {
        const persistence = new MemoryGenerationPersistence();
        const { workflow } = makeWorkflow(persistence, async type => `${type} content`);

        const outcomes = await workflow.run(artifactRequestId);

        assert.deepEqual(outcomes.map(outcome => outcome.type), ["X_POST", "LINKEDIN_POST"]);
        assert.equal(persistence.artifacts.size, 2);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("skips generation when an Artifact already exists", async () => {
        const persistence = new MemoryGenerationPersistence();
        const existing: Artifact = {
            id: "existing-x-artifact",
            artifactRequestId,
            type: "X_POST",
            content: "Existing content",
            createdAt: new Date("2026-10-06T10:00:00.000Z"),
        };
        persistence.artifacts.set("X_POST", existing);
        const { workflow, calls } = makeWorkflow(persistence, async type => `${type} content`);

        const outcomes = await workflow.run(artifactRequestId);

        assert.equal(calls.get("X_POST") ?? 0, 0);
        assert.equal(outcomes[0]?.disposition, "existing");
        assert.equal(persistence.status, "COMPLETED");
    });

    it("does nothing when a completed request is delivered again", async () => {
        const persistence = new MemoryGenerationPersistence();
        persistence.status = "COMPLETED";
        const { workflow, calls } = makeWorkflow(persistence, async type => `${type} content`);

        const outcomes = await workflow.run(artifactRequestId);

        assert.deepEqual(outcomes, []);
        assert.equal(calls.size, 0);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("accepts the existing Artifact when a concurrent insert wins the unique-key race", async () => {
        const persistence = new RacingGenerationPersistence();
        const { workflow, calls } = makeWorkflow(persistence, async type => `${type} content`, ["X_POST"]);

        const outcomes = await workflow.run(artifactRequestId);

        assert.equal(calls.get("X_POST"), 1);
        assert.equal(outcomes[0]?.artifactId, "concurrent-X_POST");
        assert.equal(outcomes[0]?.disposition, "existing");
        assert.equal(persistence.artifacts.size, 1);
        assert.equal(persistence.status, "COMPLETED");
    });

    it("continues processing other types after one type fails and leaves the request generating for retries", async () => {
        const persistence = new MemoryGenerationPersistence();
        const { workflow } = makeWorkflow(persistence, async type => {
            if (type === "LINKEDIN_POST") {
                throw new Error("LinkedIn generator failed");
            }
            return "X content";
        });

        await assert.rejects(workflow.run(artifactRequestId), error => {
            assert.ok(error instanceof ArtifactTypesGenerationFailedError);
            assert.deepEqual(error.failedTypes, ["LINKEDIN_POST"]);
            return true;
        });
        assert.ok(persistence.artifacts.has("X_POST"));
        assert.equal(persistence.status, "GENERATING");
    });

    it("retries a failed type without regenerating the type persisted on the prior attempt", async () => {
        const persistence = new MemoryGenerationPersistence();
        let linkedInAttempts = 0;
        const { workflow, calls } = makeWorkflow(persistence, async type => {
            if (type === "LINKEDIN_POST" && linkedInAttempts++ === 0) {
                throw new Error("temporary failure");
            }
            return `${type} content`;
        });

        await assert.rejects(workflow.run(artifactRequestId), ArtifactTypesGenerationFailedError);
        const retryOutcomes = await workflow.run(artifactRequestId);

        assert.equal(calls.get("X_POST"), 1);
        assert.equal(calls.get("LINKEDIN_POST"), 2);
        assert.equal(retryOutcomes.find(outcome => outcome.type === "X_POST")?.disposition, "existing");
        assert.equal(persistence.status, "COMPLETED");
    });

    it("marks a request failed only when the terminal failure handler runs", async () => {
        const persistence = new MemoryGenerationPersistence();
        const { workflow } = makeWorkflow(persistence, async () => {
            throw new Error("generation unavailable");
        }, ["X_POST"]);

        await assert.rejects(workflow.run(artifactRequestId), ArtifactTypesGenerationFailedError);
        assert.equal(persistence.status, "GENERATING");

        await workflow.markFailed(artifactRequestId);
        assert.equal(persistence.status, "FAILED");
    });
});

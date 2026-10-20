import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArtifactGenerator } from "../../../domain/ArtifactGenerator.js";
import type { ArtifactGenerationContext, ChangeSet } from "../../../domain/types.js";
import {
    ArtifactGenerationContextService,
    type ArtifactGenerationContextReader,
} from "./ArtifactGenerationContextService.js";
import { ArtifactGenerationService } from "./ArtifactGenerationService.js";
import {
    artifactGeneratorRegistry,
    ArtifactGeneratorRegistry,
    UnsupportedArtifactTypeError,
} from "./ArtifactGeneratorRegistry.js";

const changeSet: ChangeSet = {
    id: "changeset-id",
    repositoryId: "repository-id",
    base: "base-sha",
    head: "head-sha",
    basehead: "base-sha...head-sha",
    commits: [],
    changes: [],
    createdAt: new Date("2026-10-06T12:00:00Z"),
};

const context: ArtifactGenerationContext = {
    artifactRequest: { id: "request-id", instructions: "Emphasize user impact.", scope: { type: "LATEST" } },
    repository: { id: "repository-id", owner: "example", name: "project" },
    requestedArtifactTypes: ["X_POST", "LINKEDIN_POST"],
    changeSets: [{ role: "TARGET", changeSet }],
    evidence: [],
};

class FakeContextReader implements ArtifactGenerationContextReader {
    async getArtifactRequest() {
        return { id: context.artifactRequest.id, repositoryId: context.repository.id, instructions: context.artifactRequest.instructions, scope: context.artifactRequest.scope };
    }

    async getRepository(repositoryId: string) {
        assert.equal(repositoryId, context.repository.id);
        return context.repository;
    }

    async getRequestedArtifactTypes() {
        return context.requestedArtifactTypes;
    }

    async getLinkedChangeSets() {
        return context.changeSets;
    }
}

describe("Artifact generation domain boundary", () => {
    it("resolves a generator for each supported ArtifactType", () => {
        assert.equal(artifactGeneratorRegistry.resolve("X_POST").artifactType, "X_POST");
        assert.equal(artifactGeneratorRegistry.resolve("LINKEDIN_POST").artifactType, "LINKEDIN_POST");

        const registry = new ArtifactGeneratorRegistry([
            { artifactType: "X_POST", generate: async () => ({ type: "X_POST", candidates: [{ angle: "x", content: "x", claims: [{ claim: "x", evidence: [] }] }] }) },
            { artifactType: "LINKEDIN_POST", generate: async () => ({ type: "LINKEDIN_POST", candidates: [{ angle: "linkedin", content: "linkedin", claims: [{ claim: "linkedin", evidence: [] }] }] }) },
        ]);

        assert.equal(registry.resolve("X_POST").artifactType, "X_POST");
        assert.equal(registry.resolve("LINKEDIN_POST").artifactType, "LINKEDIN_POST");
    });

    it("rejects an unsupported artifact type", () => {
        const registry = new ArtifactGeneratorRegistry([]);
        assert.throws(() => registry.resolve("NEWSLETTER"), UnsupportedArtifactTypeError);
    });

    it("builds context from the request, repository, requested types, and linked ChangeSets", async () => {
        const builder = new ArtifactGenerationContextService(new FakeContextReader());
        assert.deepEqual(await builder.build("request-id"), context);
    });

    it("invokes only the requested generators with the built context and returns their results", async () => {
        const generated: string[] = [];
        const generators: ArtifactGenerator[] = [
            {
                artifactType: "X_POST",
                async generate(receivedContext) {
                    assert.equal(receivedContext, context);
                    generated.push("X_POST");
                    return { type: "X_POST", candidates: [{ angle: "x", content: "x result", claims: [{ claim: "x result", evidence: [] }] }] };
                },
            },
            {
                artifactType: "LINKEDIN_POST",
                async generate(receivedContext) {
                    assert.equal(receivedContext, context);
                    generated.push("LINKEDIN_POST");
                    return { type: "LINKEDIN_POST", candidates: [{ angle: "linkedin", content: "linkedin result", claims: [{ claim: "linkedin result", evidence: [] }] }] };
                },
            },
        ];
        const contextService = { build: async () => context };
        const service = new ArtifactGenerationService(contextService, new ArtifactGeneratorRegistry(generators));

        const results = await service.generate("request-id");

        assert.deepEqual(generated, ["X_POST", "LINKEDIN_POST"]);
        assert.deepEqual(results, [
            { type: "X_POST", candidates: [{ angle: "x", content: "x result", claims: [{ claim: "x result", evidence: [] }] }] },
            { type: "LINKEDIN_POST", candidates: [{ angle: "linkedin", content: "linkedin result", claims: [{ claim: "linkedin result", evidence: [] }] }] },
        ]);
    });
});

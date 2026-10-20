import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArtifactGenerationContext, GenerationCandidateInput } from "../../../domain/types.js";
import type { OpenRouterClient } from "../llm/OpenRouterClient.js";
import type { CandidateValidator } from "./CandidateValidator.js";
import { OpenRouterCandidateGenerator } from "./OpenRouterCandidateGenerator.js";

const context: ArtifactGenerationContext = {
    artifactRequest: { id: "request-id", instructions: "Focus on token checks", scope: { type: "TODAY" } },
    repository: { id: "repo-id", owner: "example", name: "app" },
    requestedArtifactTypes: ["X_POST"],
    changeSets: [],
    evidence: [{ changeSetId: "8c93393c-328e-4d56-b694-04d1a17d8aaa", role: "TARGET", text: "Added token validation to login." }],
};

function candidate(angle: string, content: string): GenerationCandidateInput {
    return { angle, content, claims: [{ claim: content, evidence: [{ changeSetId: "8c93393c-328e-4d56-b694-04d1a17d8aaa", quote: "Added token validation to login." }] }] };
}

function modelClient(candidates: GenerationCandidateInput[]): Pick<OpenRouterClient, "completeJson"> {
    return {
        async completeJson<T>(input: { schema: import("zod").ZodType<T> }): Promise<T> {
            return input.schema.parse({ candidates });
        },
    };
}

describe("OpenRouterCandidateGenerator", () => {
    it("returns multiple validated candidates for one platform type", async () => {
        const validator: Pick<CandidateValidator, "validate"> = { validate: async () => [] };
        const generator = new OpenRouterCandidateGenerator("X_POST", modelClient([
            candidate("Safer login", "Added token validation to login."),
            candidate("Token checks", "Login now validates tokens."),
        ]), validator);

        const result = await generator.generate(context);
        assert.equal(result.type, "X_POST");
        assert.equal(result.candidates.length, 2);
    });

    it("keeps one candidate when it is the only validated distinct angle", async () => {
        const validator: Pick<CandidateValidator, "validate"> = { validate: async () => [] };
        const generator = new OpenRouterCandidateGenerator("X_POST", modelClient([
            candidate("Safer login", "Added token validation to login."),
            candidate("Safer login", "A duplicate angle."),
        ]), validator);
        const result = await generator.generate(context);
        assert.equal(result.candidates.length, 1);
    });
});

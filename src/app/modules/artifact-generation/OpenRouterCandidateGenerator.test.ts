import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { z } from "zod";
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

type CapturedPrompt = {
    system: string;
    user: string;
    schema: z.ZodType<unknown>;
    promptVersion?: string;
};

function modelClient(candidates: GenerationCandidateInput[], onCall?: (input: CapturedPrompt) => void): Pick<OpenRouterClient, "completeJson"> {
    return {
        async completeJson<T>(input: {
            schema: import("zod").ZodType<T>;
            system?: string;
            user?: string;
            telemetry?: { promptVersion?: string };
        }): Promise<T> {
            if (input.user !== undefined && input.system !== undefined) {
                onCall?.({
                    system: input.system,
                    user: input.user,
                    schema: input.schema as z.ZodType<unknown>,
                    ...(input.telemetry?.promptVersion ? { promptVersion: input.telemetry.promptVersion } : {}),
                });
            }
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

    it("documents and exemplifies the exact candidate schema in the versioned prompt", async () => {
        let captured: CapturedPrompt | undefined;
        const generator = new OpenRouterCandidateGenerator("X_POST", modelClient([
            candidate("Token checks", "Login validates tokens."),
        ], prompt => { captured = prompt; }), { validate: async () => [] });

        await generator.generate(context);

        assert.ok(captured);
        const prompt = captured;
        assert.match(prompt.system, /angle.*maximum 120 characters/);
        assert.match(prompt.system, /changeSetId as a valid UUID/);
        assert.match(prompt.system, /quote.*12–400 characters inclusive/);
        const exampleMatch = prompt.system.match(/Example: (\{.*\})\./);
        assert.ok(exampleMatch);
        const example: unknown = JSON.parse(exampleMatch[1]!);
        assert.doesNotThrow(() => prompt.schema.parse(example));
        assert.equal(prompt.promptVersion, "candidate-generation.v2");
    });

    it("sanitizes instructions and evidence before candidate generation and retains useful code", async () => {
        let sent = "";
        const privateContext: ArtifactGenerationContext = {
            ...context,
            artifactRequest: {
                ...context.artifactRequest,
                instructions: "Focus on dev@example.com and token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
            },
            evidence: [{
                ...context.evidence[0]!,
                text: "Commit: Add validation\nFile: src/auth.ts\nconst token = validateToken(input);\nconst apiKey = 'synthetic-secret-value';",
            }],
        };
        const generator = new OpenRouterCandidateGenerator("X_POST", modelClient([
            candidate("Token checks", "Added token validation to login."),
        ], input => { sent = input.user; }), { validate: async () => [] });

        await generator.generate(privateContext);
        assert.ok(!sent.includes("dev@example.com"));
        assert.ok(!sent.includes("ghp_abcdefghijklmnopqrstuvwxyz1234567890"));
        assert.ok(!sent.includes("synthetic-secret-value"));
        assert.ok(!sent.includes("repo-id"));
        assert.ok(sent.includes("validateToken(input)"));
        assert.ok(sent.includes("[REDACTED]"));
    });
});

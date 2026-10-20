import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArtifactEvidenceItem, GenerationCandidateInput } from "../../../domain/types.js";
import type { OpenRouterClient } from "../llm/OpenRouterClient.js";
import { CandidateValidationError, CandidateValidator } from "./CandidateValidator.js";

const evidence: ArtifactEvidenceItem[] = [{
    changeSetId: "8c93393c-328e-4d56-b694-04d1a17d8aaa",
    role: "TARGET",
    text: "Implemented token validation in the login endpoint.",
}];
const candidate: GenerationCandidateInput = {
    angle: "Safer login",
    content: "Added token validation to login.",
    claims: [{
        claim: "Token validation was added to login.",
        evidence: [{ changeSetId: evidence[0]!.changeSetId, quote: "Implemented token validation in the login endpoint." }],
    }],
};

function fakeClient(result: unknown): Pick<OpenRouterClient, "completeJson"> {
    return {
        async completeJson<T>(input: { schema: import("zod").ZodType<T> }): Promise<T> {
            return input.schema.parse(result);
        },
    };
}

describe("CandidateValidator", () => {
    it("accepts an evidenced, safe candidate and returns persisted claim references", async () => {
        const validator = new CandidateValidator(fakeClient({
            factuallySupported: true, followsInstructions: true, safe: true, sufficientEvidence: true, reasons: [],
        }));
        const result = await validator.validate({ type: "X_POST", instructions: "Focus on login", candidate, evidence });
        assert.deepEqual(result, [{ claim: candidate.claims[0]!.claim, ...candidate.claims[0]!.evidence[0]! }]);
    });

    it("rejects a reference that is not an exact quote from supplied evidence", async () => {
        const validator = new CandidateValidator(fakeClient({
            factuallySupported: true, followsInstructions: true, safe: true, sufficientEvidence: true, reasons: [],
        }));
        const unsupported = { ...candidate, claims: [{
            claim: "The change improved conversions by 30%.",
            evidence: [{ changeSetId: evidence[0]!.changeSetId, quote: "Improved conversions by 30 percent" }],
        }] };
        await assert.rejects(
            validator.validate({ type: "X_POST", instructions: null, candidate: unsupported, evidence }),
            CandidateValidationError,
        );
    });

    it("fails closed when the evaluator reports an unsupported claim", async () => {
        const validator = new CandidateValidator(fakeClient({
            factuallySupported: false, followsInstructions: true, safe: true, sufficientEvidence: false, reasons: ["Unsupported impact"],
        }));
        await assert.rejects(validator.validate({ type: "X_POST", instructions: null, candidate, evidence }), CandidateValidationError);
    });

    it("enforces X character limit deterministically", async () => {
        const validator = new CandidateValidator(fakeClient({
            factuallySupported: true, followsInstructions: true, safe: true, sufficientEvidence: true, reasons: [],
        }));
        await assert.rejects(
            validator.validate({ type: "X_POST", instructions: null, candidate: { ...candidate, content: "x".repeat(281) }, evidence }),
            CandidateValidationError,
        );
    });

    it("rejects secret-like values and personal email addresses deterministically", async () => {
        const validator = new CandidateValidator(fakeClient({
            factuallySupported: true, followsInstructions: true, safe: true, sufficientEvidence: true, reasons: [],
        }));
        await assert.rejects(
            validator.validate({ type: "X_POST", instructions: null, candidate: { ...candidate, content: "Contact dev@example.com" }, evidence }),
            CandidateValidationError,
        );
    });
});

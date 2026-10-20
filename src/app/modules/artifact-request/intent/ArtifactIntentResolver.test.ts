import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActivityMapEntry, ArtifactRequestScope } from "../../../../domain/types.js";
import type { OpenRouterClient } from "../../llm/OpenRouterClient.js";
import { ArtifactIntentResolver } from "./ArtifactIntentResolver.js";

const activity: ActivityMapEntry[] = [{
    id: "changeset-id",
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    repository: { id: "repo-id", owner: "sample", name: "app" },
    files: [{ filename: "src/auth.ts", status: "modified", additions: 4, deletions: 1 }],
    commitMessages: ["Validate login tokens"],
    additions: 4,
    deletions: 1,
}];

function fakeClient(output: unknown): Pick<OpenRouterClient, "completeJson"> {
    return {
        async completeJson<T>(input: { schema: import("zod").ZodType<T> }): Promise<T> {
            return input.schema.parse(output);
        },
    };
}

describe("ArtifactIntentResolver", () => {
    it("infers supported scope and focus terms from instructions and the activity map", async () => {
        const resolver = new ArtifactIntentResolver(fakeClient({
            scope: { type: "DATE_RANGE", from: "2026-10-12", to: "2026-10-12" },
            focusTerms: ["authentication", "tokens"],
            clarification: null,
        }));
        const result = await resolver.interpret({ instructions: "Summarize today's token work", explicitScope: undefined, activity });
        assert.equal(result.scope.type, "DATE_RANGE");
        assert.deepEqual(result.focusTerms, ["authentication", "tokens"]);
        assert.equal(result.clarification, null);
    });

    it("preserves explicit scope even when model output differs", async () => {
        const explicitScope: ArtifactRequestScope = { type: "LATEST" };
        const resolver = new ArtifactIntentResolver(fakeClient({
            scope: { type: "YESTERDAY" }, focusTerms: ["auth"], clarification: null,
        }));
        const result = await resolver.interpret({ instructions: "Focus on authentication", explicitScope, activity });
        assert.deepEqual(result.scope, explicitScope);
    });

    it("asks for clarification instead of guessing when there is no scope or instruction", async () => {
        const resolver = new ArtifactIntentResolver(fakeClient({}));
        const result = await resolver.interpret({ instructions: " ", explicitScope: undefined, activity: [] });
        assert.equal(result.clarification, "Tell us what work or time period you want the artifact to cover.");
    });
});

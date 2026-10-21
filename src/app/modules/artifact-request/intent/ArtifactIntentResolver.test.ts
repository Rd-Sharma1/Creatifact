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

function fakeClient(output: unknown, onCall?: (input: { user: string }) => void): Pick<OpenRouterClient, "completeJson"> {
    return {
        async completeJson<T>(input: { schema: import("zod").ZodType<T>; user?: string }): Promise<T> {
            if (input.user !== undefined) onCall?.({ user: input.user });
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

    it("sanitizes instructions and activity before scope interpretation", async () => {
        let sent = "";
        const resolver = new ArtifactIntentResolver(fakeClient({
            scope: { type: "TODAY" }, focusTerms: ["auth"], clarification: null,
        }, input => { sent = input.user; }));

        await resolver.interpret({
            instructions: "Focus on dev@example.com and token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
            explicitScope: undefined,
            activity: [{
                ...activity[0]!,
                files: [{ ...activity[0]!.files[0]!, filename: "src/auth.ts?api_key=synthetic-secret-value" }],
                commitMessages: ["Validate login tokens; API_KEY=synthetic-api-key-value-12345"],
            }],
        });

        assert.ok(!sent.includes("dev@example.com"));
        assert.ok(!sent.includes("ghp_abcdefghijklmnopqrstuvwxyz1234567890"));
        assert.ok(!sent.includes("synthetic-secret-value"));
        assert.ok(!sent.includes("synthetic-api-key-value-12345"));
        assert.ok(!sent.includes("repo-id"));
        assert.ok(!sent.includes("changeset-id"));
        assert.ok(sent.includes("src/auth.ts"));
        assert.ok(sent.includes("Validate login tokens"));
    });
});

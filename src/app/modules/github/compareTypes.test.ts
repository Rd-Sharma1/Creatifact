import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { githubCompareResponseSchema } from "./compareTypes.js";

describe("GitHub Compare response schema", () => {
    it("accepts the fields used by the normalized ChangeSet mapper", () => {
        const parsed = githubCompareResponseSchema.parse({
            commits: [{
                sha: "commit-sha",
                html_url: "https://github.com/example/project/commit/commit-sha",
                commit: { message: "Add validation", author: { name: "Developer", date: "2026-10-21T00:00:00Z" } },
                author: { login: "developer" },
            }],
            files: [{ filename: "src/auth.ts", previous_filename: null, status: "modified", additions: 2, deletions: 1, changes: 3, patch: "@@" }],
            total_commits: 1,
        });
        assert.equal(parsed.commits?.[0]?.commit.message, "Add validation");
        assert.equal(parsed.files?.[0]?.filename, "src/auth.ts");
    });

    it("rejects malformed external commit and file fields", () => {
        assert.equal(githubCompareResponseSchema.safeParse({ commits: [{ sha: "", commit: {} }] }).success, false);
        assert.equal(githubCompareResponseSchema.safeParse({ files: [{ filename: "x.ts", status: "modified", additions: -1, deletions: 0, changes: 1 }] }).success, false);
    });
});

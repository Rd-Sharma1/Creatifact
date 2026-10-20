import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArtifactGenerationChangeSet } from "../../../domain/types.js";
import { EvidenceBuilder, MAX_EVIDENCE_CHARACTERS } from "./EvidenceBuilder.js";

describe("EvidenceBuilder", () => {
    it("prioritizes target work, includes normalized commit/file evidence, and enforces the context bound", () => {
        const changesets: ArtifactGenerationChangeSet[] = [
            {
                role: "SUPPORTING",
                changeSet: {
                    id: "support", repositoryId: "repo", base: "b", head: "s", basehead: "b...s",
                    commits: [{ sha: "s", message: "Older related auth work", author: { name: null, username: null }, timestamp: null, url: "" }],
                    changes: [], createdAt: new Date("2026-10-01T00:00:00Z"),
                },
            },
            {
                role: "TARGET",
                changeSet: {
                    id: "target", repositoryId: "repo", base: "b", head: "t", basehead: "b...t",
                    commits: [{ sha: "t", message: "Add token validation", author: { name: null, username: null }, timestamp: null, url: "" }],
                    changes: [{ filename: "src/auth.ts", previousFilename: null, status: "modified", additions: 1, deletions: 0, changes: 1, patch: "x".repeat(30_000) }],
                    createdAt: new Date("2026-10-12T00:00:00Z"),
                },
            },
        ];
        const result = new EvidenceBuilder().build(changesets);
        assert.equal(result[0]?.role, "TARGET");
        assert.ok(result[0]?.text.includes("Add token validation"));
        assert.equal(result.reduce((sum, item) => sum + item.text.length, 0), MAX_EVIDENCE_CHARACTERS);
    });
});

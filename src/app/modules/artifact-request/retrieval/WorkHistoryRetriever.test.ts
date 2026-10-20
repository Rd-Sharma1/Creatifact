import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActivityMapEntry, ChangeSet } from "../../../../domain/types.js";
import type { ActivityMapReader } from "../activity/ActivityMapRepository.js";
import { WorkHistoryRetriever, type FullChangeSetReader } from "./WorkHistoryRetriever.js";

function changeSet(id: string, filename: string, createdAt: string): ChangeSet {
    return {
        id, repositoryId: "repo-id", base: "base", head: id, basehead: `base...${id}`,
        commits: [{ sha: id, message: `Update ${filename}`, author: { name: null, username: null }, timestamp: null, url: "" }],
        changes: [{ filename, previousFilename: null, status: "modified", additions: 1, deletions: 0, changes: 1, patch: `diff for ${filename}` }],
        createdAt: new Date(createdAt),
    };
}

function mapEntry(item: ChangeSet): ActivityMapEntry {
    return {
        id: item.id, createdAt: item.createdAt,
        repository: { id: item.repositoryId, owner: "owner", name: "repo" },
        files: item.changes.map(file => ({ filename: file.filename, status: file.status, additions: file.additions, deletions: file.deletions })),
        commitMessages: item.commits.map(commit => commit.message), additions: 1, deletions: 0,
    };
}

describe("WorkHistoryRetriever", () => {
    it("keeps scope targets distinct and adds older same-path ChangeSets as supporting context", async () => {
        const target = changeSet("target", "src/auth.ts", "2026-10-12T10:00:00.000Z");
        const support = changeSet("support", "src/auth.ts", "2026-10-01T10:00:00.000Z");
        const unrelated = changeSet("unrelated", "src/home.ts", "2026-10-11T10:00:00.000Z");
        const retriever = new WorkHistoryRetriever(
            { resolve: async () => [target] },
            { recent: async () => [mapEntry(unrelated), mapEntry(target), mapEntry(support)] } satisfies ActivityMapReader,
            { byIds: async ids => ids.map(id => [target, support, unrelated].find(item => item.id === id)!).filter(Boolean) } satisfies FullChangeSetReader,
        );

        const result = await retriever.resolve({ repositoryId: "repo-id", scope: { type: "TODAY" }, focusTerms: [] });

        assert.deepEqual(result.map(item => [item.changeSet.id, item.role]), [["support", "SUPPORTING"], ["target", "TARGET"]]);
    });

    it("applies the target bound and repository boundary through its inputs", async () => {
        const targets = Array.from({ length: 14 }, (_, index) => changeSet(`target-${index}`, `src/${index}.ts`, `2026-10-12T${String(index).padStart(2, "0")}:00:00.000Z`));
        const loadCalls: string[][] = [];
        const retriever = new WorkHistoryRetriever(
            { resolve: async () => targets },
            { recent: async () => [] },
            { byIds: async ids => {
                loadCalls.push(ids);
                return ids.map(id => targets.find(item => item.id === id)!).filter(Boolean);
            } },
        );
        const result = await retriever.resolve({ repositoryId: "repo-id", scope: { type: "TODAY" }, focusTerms: [] });
        assert.equal(result.length, 12);
        assert.equal(loadCalls[0]?.length, 12);
        assert.ok(result.every(item => item.role === "TARGET"));
    });
});

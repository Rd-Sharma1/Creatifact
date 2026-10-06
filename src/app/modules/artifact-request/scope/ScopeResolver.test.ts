import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChangeSet } from "../../../../domain/types.js";
import { ScopeResolver, type ChangeSetScopeStore, type ScopeDateBounds } from "./ScopeResolver.js";

const repositoryId = "repository-a";
const now = new Date(2026, 6, 15, 12, 30);

function changeSet(id: string, createdAt: Date, owner = repositoryId): ChangeSet {
    return {
        id,
        repositoryId: owner,
        base: "base-sha",
        head: "head-sha",
        basehead: "base-sha...head-sha",
        commits: [],
        changes: [],
        createdAt,
    };
}

const history = [
    changeSet("july-6", new Date(2026, 6, 6, 9)),
    changeSet("july-12", new Date(2026, 6, 12, 18)),
    changeSet("july-13", new Date(2026, 6, 13, 0)),
    changeSet("july-14", new Date(2026, 6, 14, 10)),
    changeSet("july-15-early", new Date(2026, 6, 15, 0)),
    changeSet("july-15-late", new Date(2026, 6, 15, 23, 59)),
    changeSet("july-16", new Date(2026, 6, 16, 0)),
    changeSet("other-repository", new Date(2026, 6, 15, 12), "repository-b"),
];

class MemoryScopeStore implements ChangeSetScopeStore {
    async findCreatedBetween(id: string, bounds: ScopeDateBounds): Promise<ChangeSet[]> {
        return history.filter(
            item =>
                item.repositoryId === id &&
                item.createdAt >= bounds.fromInclusive &&
                item.createdAt < bounds.toExclusive,
        );
    }

    async findLatest(id: string): Promise<ChangeSet | undefined> {
        return history
            .filter(item => item.repositoryId === id)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))[0];
    }
}

const resolver = new ScopeResolver(new MemoryScopeStore());

describe("ScopeResolver", () => {
    it("resolves TODAY within the current local calendar day", async () => {
        const result = await resolver.resolve(repositoryId, { type: "TODAY" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-15-early", "july-15-late"]);
    });

    it("resolves YESTERDAY within the previous local calendar day", async () => {
        const result = await resolver.resolve(repositoryId, { type: "YESTERDAY" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-14"]);
    });

    it("resolves THIS_WEEK from Monday through the current day", async () => {
        const result = await resolver.resolve(repositoryId, { type: "THIS_WEEK" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-13", "july-14", "july-15-early", "july-15-late", "july-16"]);
    });

    it("resolves LAST_WEEK as the immediately preceding Monday-to-Monday week", async () => {
        const result = await resolver.resolve(repositoryId, { type: "LAST_WEEK" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-6", "july-12"]);
    });

    it("resolves LATEST to the most recent ChangeSet for the repository", async () => {
        const result = await resolver.resolve(repositoryId, { type: "LATEST" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-16"]);
    });

    it("treats DATE_RANGE endpoints as inclusive local calendar dates", async () => {
        const result = await resolver.resolve(repositoryId, { type: "DATE_RANGE", from: "2026-07-12", to: "2026-07-14" }, now);
        assert.deepEqual(result.map(item => item.id), ["july-12", "july-13", "july-14"]);
    });

    it("returns an empty list when the scope matches no ChangeSets", async () => {
        const result = await resolver.resolve(repositoryId, { type: "DATE_RANGE", from: "2025-01-01", to: "2025-01-01" }, now);
        assert.deepEqual(result, []);
    });
});

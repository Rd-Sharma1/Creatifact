import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artifactRequestCreateSchema } from "./schema.js";

const base = { repositoryId: "8c93393c-328e-4d56-b694-04d1a17d8aaa", artifactTypes: ["X_POST"] };

describe("artifactRequestCreateSchema", () => {
    it("accepts omitted scope for server-side inference", () => {
        assert.equal(artifactRequestCreateSchema.safeParse(base).success, true);
    });

    it("rejects invalid date ranges and duplicate artifact types", () => {
        assert.equal(artifactRequestCreateSchema.safeParse({
            ...base, scope: { type: "DATE_RANGE", from: "2026-10-13", to: "2026-10-12" },
        }).success, false);
        assert.equal(artifactRequestCreateSchema.safeParse({
            ...base, artifactTypes: ["X_POST", "X_POST"], scope: { type: "LATEST" },
        }).success, false);
    });
});

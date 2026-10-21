import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSchemaSnapshot, mapMigrationHistory, validateTestDatabaseUrl } from "./db-preflight.js";

describe("database preflight helpers", () => {
    it("requires a separate test database with an explicit test suffix", () => {
        assert.match(validateTestDatabaseUrl(undefined, undefined) ?? "", /required/);
        assert.match(validateTestDatabaseUrl("postgresql://user:secret@localhost/app", "postgresql://user:secret@localhost/app") ?? "", /ends in _test/);
        assert.match(validateTestDatabaseUrl("postgresql://user:secret@localhost/app_test", undefined) ?? "", /DATABASE_URL is required/);
        assert.match(validateTestDatabaseUrl("postgresql://user:secret@localhost/app_test", "postgresql://user:secret@localhost/app_test") ?? "", /same database/);
        assert.equal(validateTestDatabaseUrl("postgresql://user:secret@localhost/app_test", "postgresql://user:secret@localhost/app"), undefined);
    });

    it("maps only matching migration hashes and reports pending journal entries", () => {
        const journal = {
            entries: [
                { idx: 0, when: 100, tag: "0000_first" },
                { idx: 1, when: 200, tag: "0001_second" },
            ],
        };
        const result = mapMigrationHistory(journal, [{ hash: "hash-a", created_at: "100" }], new Map([
            ["0000_first", "hash-a"], ["0001_second", "hash-b"],
        ]));
        assert.deepEqual(result.appliedTags, ["0000_first"]);
        assert.deepEqual(result.pendingTags, ["0001_second"]);
        assert.deepEqual(result.errors, []);

        const mismatch = mapMigrationHistory(journal, [{ hash: "wrong", created_at: "100" }], new Map([["0000_first", "hash-a"]]));
        assert.equal(mismatch.errors.length, 1);
    });

    it("compares physical columns with the snapshot for the recorded migration baseline", () => {
        const snapshot = {
            tables: {
                "public.repositories": {
                    name: "repositories",
                    columns: {
                        id: { name: "id", type: "uuid", notNull: true, default: "gen_random_uuid()" },
                        name: { name: "name", type: "varchar(100)", notNull: true },
                    },
                },
            },
        };
        const catalog = [
            { table_name: "repositories", column_name: "id", data_type: "uuid", udt_name: "uuid", is_nullable: "NO" as const, character_maximum_length: null, column_default: "gen_random_uuid()" },
            { table_name: "repositories", column_name: "name", data_type: "character varying", udt_name: "varchar", is_nullable: "NO" as const, character_maximum_length: 100, column_default: null },
        ];
        assert.deepEqual(compareSchemaSnapshot(snapshot, catalog), { errors: [], extras: [] });
        const drifted = compareSchemaSnapshot(snapshot, catalog.slice(0, 1));
        assert.deepEqual(drifted.errors, ["Missing column public.repositories.name."]);
    });

    it("blocks missing named constraints and enum mismatches", () => {
        const snapshot = {
            tables: {
                "public.repositories": {
                    name: "repositories",
                    columns: { id: { name: "id", type: "uuid", notNull: true, primaryKey: true } },
                    foreignKeys: { repositories_owner_fk: { name: "repositories_owner_fk" } },
                },
            },
            enums: { "public.status": { name: "status", values: ["READY", "FAILED"] } },
        };
        const catalog = [{ table_name: "repositories", column_name: "id", data_type: "uuid", udt_name: "uuid", is_nullable: "NO" as const, character_maximum_length: null, column_default: null }];
        const comparison = compareSchemaSnapshot(snapshot, catalog, [], [{ type_name: "status", label: "READY" }]);
        assert.deepEqual(comparison.errors, [
            "Missing constraint or index public.repositories.repositories_pkey.",
            "Missing constraint or index public.repositories.repositories_owner_fk.",
            "Enum public.status values differ from the migration snapshot.",
        ]);
    });
});

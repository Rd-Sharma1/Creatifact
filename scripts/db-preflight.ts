import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

type JournalEntry = { idx: number; when: number; tag: string };
type Journal = { entries: JournalEntry[] };
type SnapshotColumn = { name: string; type: string; notNull: boolean; default?: string; primaryKey?: boolean };
type SnapshotTable = {
    name: string;
    columns: Record<string, SnapshotColumn>;
    compositePrimaryKeys?: Record<string, { name: string }>;
    indexes?: Record<string, { name: string }>;
    foreignKeys?: Record<string, { name: string }>;
    uniqueConstraints?: Record<string, { name: string }>;
    checkConstraints?: Record<string, { name: string }>;
};
type Snapshot = {
    tables: Record<string, SnapshotTable>;
    enums?: Record<string, { name: string; values: string[] }>;
};
type CatalogObject = { table_name: string; object_name: string };
type CatalogEnumLabel = { type_name: string; label: string };
type CatalogColumn = {
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: "YES" | "NO";
    character_maximum_length: number | null;
    column_default: string | null;
};

export type AppliedMigration = { hash: string; created_at: string | number };

export function validateTestDatabaseUrl(testUrl: string | undefined, appUrl: string | undefined): string | undefined {
    if (!testUrl) return "TEST_DATABASE_URL is required for database-backed tests.";

    let test: URL;
    try {
        test = new URL(testUrl);
    } catch {
        return "TEST_DATABASE_URL must be a valid PostgreSQL connection URL.";
    }
    if (test.protocol !== "postgres:" && test.protocol !== "postgresql:") {
        return "TEST_DATABASE_URL must use the postgres or postgresql protocol.";
    }
    const databaseName = decodeURIComponent(test.pathname.slice(1));
    if (!databaseName.endsWith("_test")) {
        return "TEST_DATABASE_URL must target a database whose name ends in _test.";
    }
    if (appUrl) {
        try {
            const app = new URL(appUrl);
            const appDatabaseName = decodeURIComponent(app.pathname.slice(1));
            const testPort = test.port || "5432";
            const appPort = app.port || "5432";
            if (test.hostname.toLowerCase() === app.hostname.toLowerCase() && testPort === appPort && databaseName === appDatabaseName) {
                return "TEST_DATABASE_URL must not target the same database as DATABASE_URL.";
            }
        } catch {
            // DATABASE_URL is only used to detect accidental reuse; never print it.
        }
    }
    return undefined;
}

export function mapMigrationHistory(
    journal: Journal,
    applied: AppliedMigration[],
    hashes: Map<string, string>,
): { appliedTags: string[]; pendingTags: string[]; errors: string[] } {
    const errors: string[] = [];
    const appliedTags: string[] = [];
    for (const row of [...applied].sort((a, b) => Number(a.created_at) - Number(b.created_at))) {
        const entry = journal.entries.find(candidate => candidate.when === Number(row.created_at));
        if (!entry) {
            errors.push(`Database migration timestamp ${row.created_at} is absent from the repository journal.`);
            continue;
        }
        const expectedHash = hashes.get(entry.tag);
        if (!expectedHash || expectedHash !== row.hash) {
            errors.push(`Recorded migration ${entry.tag} does not match the checked-in migration file hash.`);
            continue;
        }
        appliedTags.push(entry.tag);
    }

    const journalPrefix = journal.entries.slice(0, appliedTags.length).map(entry => entry.tag);
    if (journalPrefix.some((tag, index) => tag !== appliedTags[index])) {
        errors.push("Applied migrations are not a contiguous prefix of the checked-in migration journal.");
    }
    return {
        appliedTags,
        pendingTags: journal.entries.slice(appliedTags.length).map(entry => entry.tag),
        errors,
    };
}

export function compareSchemaSnapshot(
    snapshot: Snapshot,
    catalog: CatalogColumn[],
    objects?: CatalogObject[],
    enumLabels?: CatalogEnumLabel[],
): { errors: string[]; extras: string[] } {
    const errors: string[] = [];
    const extras: string[] = [];
    const byTable = new Map<string, CatalogColumn[]>();
    for (const column of catalog) {
        byTable.set(column.table_name, [...(byTable.get(column.table_name) ?? []), column]);
    }

    for (const [qualifiedName, table] of Object.entries(snapshot.tables)) {
        const physicalColumns = byTable.get(table.name);
        if (!physicalColumns) {
            errors.push(`Missing table public.${table.name}.`);
            continue;
        }
        const actual = new Map(physicalColumns.map(column => [column.column_name, column]));
        for (const expected of Object.values(table.columns)) {
            const found = actual.get(expected.name);
            if (!found) {
                errors.push(`Missing column public.${table.name}.${expected.name}.`);
                continue;
            }
            const expectedType = normalizeSnapshotType(expected.type);
            if (found.data_type !== expectedType.dataType ||
                (expectedType.udtName && found.udt_name !== expectedType.udtName) ||
                (expectedType.length !== undefined && found.character_maximum_length !== expectedType.length)) {
                errors.push(`Type mismatch for public.${table.name}.${expected.name}: expected ${expected.type}, found ${found.data_type}${found.udt_name === found.data_type ? "" : ` (${found.udt_name})`}.`);
            }
            if ((found.is_nullable === "NO") !== expected.notNull) {
                errors.push(`Nullability mismatch for public.${table.name}.${expected.name}.`);
            }
            if (Boolean(found.column_default) !== Boolean(expected.default)) {
                errors.push(`Default mismatch for public.${table.name}.${expected.name}.`);
            }
        }
        const expectedNames = new Set(Object.values(table.columns).map(column => column.name));
        for (const column of physicalColumns) {
            if (!expectedNames.has(column.column_name)) extras.push(`Extra column public.${table.name}.${column.column_name}.`);
        }
        if (objects) {
            const expectedObjects = new Set<string>();
            for (const column of Object.values(table.columns)) {
                if (column.primaryKey) expectedObjects.add(`${table.name}_pkey`);
            }
            for (const collection of [table.compositePrimaryKeys, table.indexes, table.foreignKeys, table.uniqueConstraints, table.checkConstraints]) {
                for (const item of Object.values(collection ?? {})) expectedObjects.add(item.name);
            }
            const actualObjects = new Set(objects.filter(item => item.table_name === table.name).map(item => item.object_name));
            for (const name of expectedObjects) {
                if (!actualObjects.has(name)) errors.push(`Missing constraint or index public.${table.name}.${name}.`);
            }
            for (const name of actualObjects) {
                if (!expectedObjects.has(name)) extras.push(`Extra constraint or index public.${table.name}.${name}.`);
            }
        }
        void qualifiedName;
    }
    if (enumLabels && snapshot.enums) {
        for (const expected of Object.values(snapshot.enums)) {
            const actual = enumLabels.filter(label => label.type_name === expected.name).map(label => label.label);
            if (actual.join("\u0000") !== expected.values.join("\u0000")) {
                errors.push(`Enum public.${expected.name} values differ from the migration snapshot.`);
            }
        }
    }
    return { errors, extras };
}

function normalizeSnapshotType(type: string): { dataType: string; udtName?: string; length?: number } {
    const varchar = /^varchar\((\d+)\)$/.exec(type);
    if (varchar) return { dataType: "character varying", length: Number(varchar[1]) };
    if (type === "timestamp") return { dataType: "timestamp without time zone" };
    if (["artifact_type", "artifact_candidate_status", "artifact_request_changeset_role", "artifact_request_status"].includes(type)) {
        return { dataType: "USER-DEFINED", udtName: type };
    }
    return { dataType: type };
}

function migrationWarnings(sql: string): string[] {
    const warnings: string[] = [];
    if (/\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b/i.test(sql)) warnings.push("contains a DROP operation");
    if (/\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b/i.test(sql) && !/\bADD\s+COLUMN\b[^;]*\bDEFAULT\b/i.test(sql)) {
        warnings.push("adds a NOT NULL column without a default; existing rows may prevent application");
    }
    if (/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i.test(sql)) warnings.push("changes a column type");
    return warnings;
}

async function readJson<T>(file: string): Promise<T> {
    return JSON.parse(await readFile(file, "utf8")) as T;
}

async function runPreflight(): Promise<number> {
    const connectionString = process.env.PREFLIGHT_DATABASE_URL;
    if (!connectionString) {
        console.error("Set PREFLIGHT_DATABASE_URL explicitly. DATABASE_URL is never used as a fallback.");
        return 2;
    }

    const root = process.cwd();
    const journal = await readJson<Journal>(resolve(root, "drizzle/meta/_journal.json"));
    const files = new Map<string, string>();
    const hashes = new Map<string, string>();
    for (const entry of journal.entries) {
        const sql = await readFile(resolve(root, "drizzle", `${entry.tag}.sql`), "utf8");
        files.set(entry.tag, sql);
        hashes.set(entry.tag, createHash("sha256").update(sql).digest("hex"));
    }

    const client = new Client({ connectionString, application_name: "creatifact-read-only-migration-preflight" });
    try {
        await client.connect();
        await client.query("BEGIN TRANSACTION READ ONLY");
        const target = await client.query<{ database_name: string }>("SELECT current_database() AS database_name");
        const migrationTable = await client.query<{ exists: boolean }>(
            "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists",
        );
        let applied: AppliedMigration[] = [];
        if (migrationTable.rows[0]?.exists) {
            const result = await client.query<AppliedMigration>(
                "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
            );
            applied = result.rows;
        } else {
            const existingTables = await client.query<{ count: string }>(
                "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
            );
            if (Number(existingTables.rows[0]?.count ?? 0) > 0) {
                console.error("BLOCKER: public tables exist but drizzle.__drizzle_migrations is absent; establish a verified baseline before applying migrations.");
                return 1;
            }
        }
        const history = mapMigrationHistory(journal, applied, hashes);
        console.log(`Database: ${target.rows[0]?.database_name ?? "unknown"}`);
        console.log(`Applied migration tags: ${history.appliedTags.length ? history.appliedTags.join(", ") : "none"}`);
        console.log(`Pending migration tags: ${history.pendingTags.length ? history.pendingTags.join(", ") : "none"}`);

        const schemaErrors = [...history.errors];
        if (history.appliedTags.length > 0) {
            const lastTag = history.appliedTags.at(-1)!;
            const snapshotFile = resolve(root, "drizzle/meta", `${lastTag.slice(0, 4)}_snapshot.json`);
            const snapshot = await readJson<Snapshot>(snapshotFile);
            const tableNames = Object.values(snapshot.tables).map(table => table.name);
            const catalog = await client.query<CatalogColumn>(
                `SELECT table_name, column_name, data_type, udt_name, is_nullable, character_maximum_length, column_default
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = ANY($1::text[])
                 ORDER BY table_name, ordinal_position`,
                [tableNames],
            );
            const objects = await client.query<CatalogObject>(
                `SELECT table_name, object_name FROM (
                    SELECT t.relname AS table_name, c.conname AS object_name
                    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE n.nspname = 'public' AND t.relname = ANY($1::text[])
                    UNION
                    SELECT tablename AS table_name, indexname AS object_name
                    FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[])
                 ) named_objects`,
                [tableNames],
            );
            const enumTypes = Object.values(snapshot.enums ?? {}).map(type => type.name);
            const enumLabels = await client.query<CatalogEnumLabel>(
                `SELECT t.typname AS type_name, e.enumlabel AS label
                 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = ANY($1::text[])
                 ORDER BY t.typname, e.enumsortorder`,
                [enumTypes],
            );
            const comparison = compareSchemaSnapshot(snapshot, catalog.rows, objects.rows, enumLabels.rows);
            schemaErrors.push(...comparison.errors);
            if (comparison.extras.length) {
                console.log("Schema differences to review:");
                for (const item of comparison.extras) console.log(`  - ${item}`);
            }
        } else if (migrationTable.rows[0]?.exists) {
            schemaErrors.push("Migration table exists but contains no recognized baseline migration.");
        }

        for (const error of schemaErrors) console.error(`BLOCKER: ${error}`);
        for (const tag of history.pendingTags) {
            const warnings = migrationWarnings(files.get(tag) ?? "");
            for (const warning of warnings) console.log(`REVIEW ${tag}: ${warning}.`);
        }
        if (schemaErrors.length) {
            console.error("Preflight blocked: resolve migration-history or schema drift before planning migration application.");
            return 1;
        }
        if (history.pendingTags.length) {
            console.log("Baseline matches its recorded migration snapshot. Pending SQL and existing-data compatibility still require human review and a backup plan.");
        } else {
            console.log("Database matches the latest recorded migration snapshot.");
        }
        console.log("Read-only preflight complete; no migration or data changes were made.");
        return 0;
    } finally {
        try { await client.query("ROLLBACK"); } catch { /* The connection may have failed before opening a transaction. */ }
        await client.end().catch(() => undefined);
    }
}

async function main(): Promise<void> {
    try {
        process.exitCode = await runPreflight();
    } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        console.error(`Preflight failed (${name}). The connection URL and database details were not printed.`);
        process.exitCode = 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}

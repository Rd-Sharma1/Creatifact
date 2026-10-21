import "dotenv/config";
type JournalEntry = {
    idx: number;
    when: number;
    tag: string;
};
type Journal = {
    entries: JournalEntry[];
};
type SnapshotColumn = {
    name: string;
    type: string;
    notNull: boolean;
    default?: string;
};
type SnapshotTable = {
    name: string;
    columns: Record<string, SnapshotColumn>;
    indexes?: Record<string, {
        name: string;
    }>;
    foreignKeys?: Record<string, {
        name: string;
    }>;
    uniqueConstraints?: Record<string, {
        name: string;
    }>;
    checkConstraints?: Record<string, {
        name: string;
    }>;
};
type Snapshot = {
    tables: Record<string, SnapshotTable>;
    enums?: Record<string, {
        name: string;
        values: string[];
    }>;
};
type CatalogColumn = {
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: "YES" | "NO";
    character_maximum_length: number | null;
    column_default: string | null;
};
export type AppliedMigration = {
    hash: string;
    created_at: string | number;
};
export declare function validateTestDatabaseUrl(testUrl: string | undefined, appUrl: string | undefined): string | undefined;
export declare function mapMigrationHistory(journal: Journal, applied: AppliedMigration[], hashes: Map<string, string>): {
    appliedTags: string[];
    pendingTags: string[];
    errors: string[];
};
export declare function compareSchemaSnapshot(snapshot: Snapshot, catalog: CatalogColumn[]): {
    errors: string[];
    extras: string[];
};
export {};
//# sourceMappingURL=db-preflight.d.ts.map
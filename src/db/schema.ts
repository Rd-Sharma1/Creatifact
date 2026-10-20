import {
    bigint,
    check,
    jsonb,
    integer,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ArtifactCandidateEvidence, ArtifactRequestScope, ChangeSetChange, ChangeSetCommit } from "../domain/types.js";
import {
    ARTIFACT_CANDIDATE_STATUSES,
    ARTIFACT_REQUEST_STATUSES,
    ARTIFACT_TYPES,
    CHANGE_SET_ROLES,
} from "../domain/types.js";

export const artifactRequestStatusEnum = pgEnum("artifact_request_status", ARTIFACT_REQUEST_STATUSES);
export const artifactTypeEnum = pgEnum("artifact_type", ARTIFACT_TYPES);
export const artifactCandidateStatusEnum = pgEnum("artifact_candidate_status", ARTIFACT_CANDIDATE_STATUSES);
export const changeSetRoleEnum = pgEnum("artifact_request_changeset_role", CHANGE_SET_ROLES);

export const user = pgTable("user", {
    id: uuid("id").primaryKey().defaultRandom(),
    githubName: varchar("github_name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const repository = pgTable("repository", {
    id: uuid("id").primaryKey().defaultRandom(),
    githubRepoId: bigint("github_repo_id", { mode: "bigint" }).notNull().unique(),
    owner: varchar("owner", { length: 100 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const user_repository = pgTable(
    "user_repo",
    {
        userId: uuid()
            .notNull()
            .references(() => user.id),
        repositoryId: uuid("repository_id")
            .notNull()
            .references(() => repository.id),
    },
    table => [
        primaryKey({
            columns: [table.userId, table.repositoryId],
        }),
    ],
);

export const changeSetTable = pgTable(
    "change_sets",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        repositoryId: uuid("repository_id")
            .notNull()
            .references(() => repository.id),
        base: varchar("base", { length: 100 }).notNull(),
        head: varchar("head", { length: 100 }).notNull(),
        basehead: varchar("basehead", { length: 100 }).notNull(),
        changes: jsonb("changes").$type<ChangeSetChange[]>().notNull(),
        commits: jsonb("commits").$type<ChangeSetCommit[]>().notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    table => [unique("change_sets_repository_id_basehead_unique").on(table.repositoryId, table.basehead)],
);

export const artifactRequestTable = pgTable("artifact_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
        .notNull()
        .references(() => repository.id),
    instructions: text("instructions"),
    scope: jsonb("scope").$type<ArtifactRequestScope>(),
    status: artifactRequestStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const artifactRequestTypeTable = pgTable(
    "artifact_request_type",
    {
        artifactRequestId: uuid("artifact_request_id")
            .notNull()
            .references(() => artifactRequestTable.id),
        type: artifactTypeEnum("type").notNull(),
    },
    table => [primaryKey({ columns: [table.artifactRequestId, table.type] })],
);

export const artifactRequestChangeSetTable = pgTable(
    "artifact_request_changeset",
    {
        artifactRequestId: uuid("artifact_request_id")
            .notNull()
            .references(() => artifactRequestTable.id),
        changeSetId: uuid("change_set_id")
            .notNull()
            .references(() => changeSetTable.id),
        role: changeSetRoleEnum("role").notNull().default("TARGET"),
    },
    table => [primaryKey({ columns: [table.artifactRequestId, table.changeSetId] })],
);

export const artifactCandidateTable = pgTable(
    "artifact_candidates",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        artifactRequestId: uuid("artifact_request_id")
            .notNull()
            .references(() => artifactRequestTable.id),
        type: artifactTypeEnum("type").notNull(),
        ordinal: integer("ordinal").notNull(),
        angle: text("angle").notNull(),
        content: text("content").notNull(),
        evidence: jsonb("evidence").$type<ArtifactCandidateEvidence[]>().notNull(),
        status: artifactCandidateStatusEnum("status").notNull().default("READY"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    table => [
        unique("artifact_candidates_request_type_ordinal_unique").on(table.artifactRequestId, table.type, table.ordinal),
        uniqueIndex("artifact_candidates_one_selected_per_type_unique")
            .on(table.artifactRequestId, table.type)
            .where(sql`${table.status} = 'SELECTED'`),
        check("artifact_candidates_ordinal_check", sql`${table.ordinal} between 0 and 1`),
    ],
);

export const artifactGenerationOutboxTable = pgTable(
    "artifact_generation_outbox",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        artifactRequestId: uuid("artifact_request_id")
            .notNull()
            .unique()
            .references(() => artifactRequestTable.id),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        deliveredAt: timestamp("delivered_at"),
        attempts: integer("attempts").notNull().default(0),
    },
);

export const artifactTable = pgTable(
    "artifacts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        artifactRequestId: uuid("artifact_request_id")
            .notNull()
            .references(() => artifactRequestTable.id),
        type: artifactTypeEnum("type").notNull(),
        content: text("content").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    table => [unique("artifacts_artifact_request_id_type_unique").on(table.artifactRequestId, table.type)],
);

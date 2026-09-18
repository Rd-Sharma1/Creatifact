import { bigint, jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
    id: uuid("id").primaryKey().defaultRandom(),
    githubName: varchar("github_name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const repository = pgTable("repository", {
    id: uuid("id").primaryKey().defaultRandom(),
    githubRepoId: bigint("github_repo_id", { mode: "bigint" }),
    owner: varchar("owner", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const user_repository = pgTable(
    "user_repo",
    {
        userId: uuid()
            .notNull()
            .references(() => user.id),
        repositoryId: uuid()
            .notNull()
            .references(() => repository.id),
    },
    table => [
        primaryKey({
            columns: [table.userId, table.repositoryId],
        }),
    ],
);

export const changeSetTable = pgTable("change_sets", {
    id: uuid("id").primaryKey().defaultRandom(),

    repoId: uuid("repo_id")
        .notNull()
        .references(() => repository.id),
    basehead: varchar("basehead", { length: 100 }).notNull().unique(),

    changes: jsonb("changes").notNull(),

    commits: jsonb("commits").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

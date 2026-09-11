import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const changeSetTable = pgTable("change_sets", {
    id: uuid("id").primaryKey().defaultRandom(),

    repository: varchar("repository", { length: 100 }).notNull(),

    basehead: varchar("basehead", { length: 100 }).notNull().unique(),

    changes: jsonb("changes").notNull(),

    commits: jsonb("commits").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

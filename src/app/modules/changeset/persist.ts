import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { changeSetTable } from "../../../db/schema.js";
import type { NewChangeSet } from "../../../domain/types.js";

export async function persistChangeSet(changeSet: NewChangeSet, database: typeof db = db): Promise<string | undefined> {
    const [created] = await database
        .insert(changeSetTable)
        .values({
            repositoryId: changeSet.repositoryId,
            base: changeSet.base,
            head: changeSet.head,
            basehead: changeSet.basehead,
            changes: changeSet.changes,
            commits: changeSet.commits,
        })
        .onConflictDoNothing()
        .returning({
            id: changeSetTable.id,
        });

    if (created) {
        return created.id;
    }

    const [existing] = await database
        .select({
            id: changeSetTable.id,
        })
        .from(changeSetTable)
        .where(
            and(
                eq(changeSetTable.repositoryId, changeSet.repositoryId),
                eq(changeSetTable.basehead, changeSet.basehead),
            ),
        );

    return existing?.id;
}

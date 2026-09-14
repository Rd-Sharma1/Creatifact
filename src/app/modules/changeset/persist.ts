import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { changeSetTable } from "../../../db/schema.js";

export async function persistChangeSet(changeSet: any) {
    const [created] = await db
        .insert(changeSetTable)
        .values({
            repository: changeSet.repository,
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

    const [existing] = await db
        .select({
            id: changeSetTable.id,
        })
        .from(changeSetTable)
        .where(eq(changeSetTable.basehead, changeSet.basehead));

    return existing?.id;
}

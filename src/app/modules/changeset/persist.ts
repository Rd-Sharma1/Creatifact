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
        .returning({
            id: changeSetTable.id,
        })
        .onConflictDoNothing();
    return created;
}

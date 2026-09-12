import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { changeSetTable } from "../../../db/schema.js";

// export async function fetchChangeSet(changeSetId: string) {
//     const changeSet = await db.select().from(changeSetTable).where(eq(changeSetTable.id, changeSetId));
//     console.log("\n\t changeset/fetch.ts returning changeset \t\n", changeSet);
//     return changeSet;
// }

export async function fetchChangeSet(changeSetId: string) {
    console.log("Fetching ChangeSet:", changeSetId);
    console.log("Type:", typeof changeSetId);

    const changeSet = await db.select().from(changeSetTable).where(eq(changeSetTable.id, changeSetId));

    console.log("Result:", changeSet);

    return changeSet;
}

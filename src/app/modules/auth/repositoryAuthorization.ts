import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { repository, user_repository } from "../../../db/schema.js";

export async function userHasRepositoryAccess(userId: string, repositoryId: string, database: typeof db = db): Promise<boolean> {
    const [access] = await database.select({ id: repository.id }).from(repository)
        .innerJoin(user_repository, eq(user_repository.repositoryId, repository.id))
        .where(and(eq(repository.id, repositoryId), eq(user_repository.userId, userId)));
    return Boolean(access);
}

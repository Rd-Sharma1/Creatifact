import { db } from "../../../db/index.js";
import { repository } from "../../../db/schema.js";

export type ResolveRepositoryInput = {
    githubRepoId: bigint;
    owner: string;
    name: string;
};

export async function resolveRepository({ githubRepoId, owner, name }: ResolveRepositoryInput): Promise<string> {
    const [resolved] = await db
        .insert(repository)
        .values({ githubRepoId, owner, name })
        .onConflictDoUpdate({
            target: repository.githubRepoId,
            set: { owner, name },
        })
        .returning({ id: repository.id });

    if (!resolved) {
        throw new Error(`Could not resolve GitHub repository ${githubRepoId}`);
    }

    return resolved.id;
}

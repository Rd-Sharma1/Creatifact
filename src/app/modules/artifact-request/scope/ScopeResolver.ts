import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { changeSetTable } from "../../../../db/schema.js";
import type { ArtifactRequestScope, ChangeSet } from "../../../../domain/types.js";

export type ScopeDateBounds = {
    fromInclusive: Date;
    toExclusive: Date;
};

export type ScopedChangeSet = Pick<ChangeSet, "id" | "repositoryId" | "createdAt">;

const MAX_SCOPE_MATCHES = 200;

export interface ChangeSetScopeStore {
    findCreatedBetween(repositoryId: string, bounds: ScopeDateBounds): Promise<ScopedChangeSet[]>;
    findLatest(repositoryId: string): Promise<ScopedChangeSet | undefined>;
}

export function getScopeDateBounds(scope: Exclude<ArtifactRequestScope, { type: "LATEST" }>, now = new Date()): ScopeDateBounds {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    switch (scope.type) {
        case "TODAY":
            return { fromInclusive: todayStart, toExclusive: tomorrowStart };
        case "YESTERDAY":
            return {
                fromInclusive: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
                toExclusive: todayStart,
            };
        case "THIS_WEEK": {
            const daysSinceMonday = (now.getDay() + 6) % 7;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
            return { fromInclusive: weekStart, toExclusive: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7) };
        }
        case "LAST_WEEK": {
            const daysSinceMonday = (now.getDay() + 6) % 7;
            const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
            const lastWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() - 7);
            return { fromInclusive: lastWeekStart, toExclusive: thisWeekStart };
        }
        case "DATE_RANGE": {
            const from = scope.from.split("-").map(Number);
            const to = scope.to.split("-").map(Number);
            return {
                fromInclusive: new Date(from[0]!, from[1]! - 1, from[2]!),
                toExclusive: new Date(to[0]!, to[1]! - 1, to[2]! + 1),
            };
        }
    }
}

class DrizzleChangeSetScopeStore implements ChangeSetScopeStore {
    async findCreatedBetween(repositoryId: string, bounds: ScopeDateBounds): Promise<ScopedChangeSet[]> {
        return db
            .select({ id: changeSetTable.id, repositoryId: changeSetTable.repositoryId, createdAt: changeSetTable.createdAt })
            .from(changeSetTable)
            .where(
                and(
                    eq(changeSetTable.repositoryId, repositoryId),
                    gte(changeSetTable.createdAt, bounds.fromInclusive),
                    lt(changeSetTable.createdAt, bounds.toExclusive),
                ),
            )
            .orderBy(desc(changeSetTable.createdAt), desc(changeSetTable.id))
            .limit(MAX_SCOPE_MATCHES);
    }

    async findLatest(repositoryId: string): Promise<ScopedChangeSet | undefined> {
        const [latest] = await db
            .select({ id: changeSetTable.id, repositoryId: changeSetTable.repositoryId, createdAt: changeSetTable.createdAt })
            .from(changeSetTable)
            .where(eq(changeSetTable.repositoryId, repositoryId))
            .orderBy(desc(changeSetTable.createdAt), desc(changeSetTable.id))
            .limit(1);
        return latest;
    }
}

export class ScopeResolver {
    constructor(private readonly store: ChangeSetScopeStore = new DrizzleChangeSetScopeStore()) {}

    async resolve(repositoryId: string, scope: ArtifactRequestScope, now = new Date()): Promise<ScopedChangeSet[]> {
        if (scope.type === "LATEST") {
            const latest = await this.store.findLatest(repositoryId);
            return latest ? [latest] : [];
        }

        const changeSets = await this.store.findCreatedBetween(repositoryId, getScopeDateBounds(scope, now));
        return [...changeSets].sort(
            (left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
        );
    }
}

export const scopeResolver = new ScopeResolver();

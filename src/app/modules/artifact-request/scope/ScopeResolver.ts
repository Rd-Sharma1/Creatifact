import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { changeSetTable } from "../../../../db/schema.js";
import type { ArtifactRequestScope, ChangeSet } from "../../../../domain/types.js";

export type ScopeDateBounds = {
    fromInclusive: Date;
    toExclusive: Date;
};

export interface ChangeSetScopeStore {
    findCreatedBetween(repositoryId: string, bounds: ScopeDateBounds): Promise<ChangeSet[]>;
    findLatest(repositoryId: string): Promise<ChangeSet | undefined>;
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
    async findCreatedBetween(repositoryId: string, bounds: ScopeDateBounds): Promise<ChangeSet[]> {
        return db
            .select()
            .from(changeSetTable)
            .where(
                and(
                    eq(changeSetTable.repositoryId, repositoryId),
                    gte(changeSetTable.createdAt, bounds.fromInclusive),
                    lt(changeSetTable.createdAt, bounds.toExclusive),
                ),
            )
            .orderBy(asc(changeSetTable.createdAt), asc(changeSetTable.id));
    }

    async findLatest(repositoryId: string): Promise<ChangeSet | undefined> {
        const [latest] = await db
            .select()
            .from(changeSetTable)
            .where(eq(changeSetTable.repositoryId, repositoryId))
            .orderBy(desc(changeSetTable.createdAt), desc(changeSetTable.id))
            .limit(1);
        return latest;
    }
}

export class ScopeResolver {
    constructor(private readonly store: ChangeSetScopeStore = new DrizzleChangeSetScopeStore()) {}

    async resolve(repositoryId: string, scope: ArtifactRequestScope, now = new Date()): Promise<ChangeSet[]> {
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

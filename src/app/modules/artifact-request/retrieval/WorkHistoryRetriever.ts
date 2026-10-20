import { asc, inArray } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { changeSetTable } from "../../../../db/schema.js";
import type { ActivityMapEntry, ArtifactGenerationChangeSet, ArtifactRequestScope, ChangeSet } from "../../../../domain/types.js";
import { activityMapRepository, type ActivityMapReader } from "../activity/ActivityMapRepository.js";
import { scopeResolver, type ScopedChangeSet } from "../scope/ScopeResolver.js";

const MAX_TARGET_CHANGESETS = 12;
const MAX_SUPPORTING_CHANGESETS = 4;

export interface FullChangeSetReader {
    byIds(ids: string[]): Promise<ChangeSet[]>;
}

class DrizzleFullChangeSetReader implements FullChangeSetReader {
    async byIds(ids: string[]): Promise<ChangeSet[]> {
        if (ids.length === 0) return [];
        return db.select().from(changeSetTable)
            .where(inArray(changeSetTable.id, ids))
            .orderBy(asc(changeSetTable.createdAt), asc(changeSetTable.id));
    }
}

function activityText(entry: ActivityMapEntry): string {
    return [...entry.commitMessages, ...entry.files.map(file => file.filename)].join(" ").toLowerCase();
}

function scoreActivity(entry: ActivityMapEntry, terms: string[], targetPaths: Set<string>): number {
    const text = activityText(entry);
    const pathMatches = entry.files.reduce((count, file) => count + (targetPaths.has(file.filename) ? 5 : 0), 0);
    const termMatches = terms.reduce((count, term) => count + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
    return pathMatches + termMatches;
}

export interface WorkHistoryRetrieverContract {
    resolve(input: {
        repositoryId: string;
        scope: ArtifactRequestScope;
        focusTerms: string[];
    }): Promise<ArtifactGenerationChangeSet[]>;
}

export interface ScopeMatchReader {
    resolve(repositoryId: string, scope: ArtifactRequestScope): Promise<ScopedChangeSet[]>;
}

export class WorkHistoryRetriever implements WorkHistoryRetrieverContract {
    constructor(
        private readonly scopes: ScopeMatchReader = scopeResolver,
        private readonly activityMap: ActivityMapReader = activityMapRepository,
        private readonly changeSets: FullChangeSetReader = new DrizzleFullChangeSetReader(),
    ) {}

    async resolve(input: { repositoryId: string; scope: ArtifactRequestScope; focusTerms: string[] }): Promise<ArtifactGenerationChangeSet[]> {
        const [scopeMatches, activity] = await Promise.all([
            this.scopes.resolve(input.repositoryId, input.scope),
            this.activityMap.recent(input.repositoryId),
        ]);
        const scopeIds = new Set(scopeMatches.map(match => match.id));
        const scopeEntries = new Map(activity.filter(entry => scopeIds.has(entry.id)).map(entry => [entry.id, entry]));

        const selectedTargetIds = [...scopeMatches]
            .sort((left, right) => {
                const leftEntry = scopeEntries.get(left.id);
                const rightEntry = scopeEntries.get(right.id);
                const scoreDiff = (rightEntry ? scoreActivity(rightEntry, input.focusTerms, new Set()) : 0) -
                    (leftEntry ? scoreActivity(leftEntry, input.focusTerms, new Set()) : 0);
                return scoreDiff || right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
            })
            .slice(0, MAX_TARGET_CHANGESETS);

        const selectedTargetIdsSet = new Set(selectedTargetIds.map(match => match.id));
        const selectedTargets = await this.changeSets.byIds([...selectedTargetIdsSet]);
        const targetPaths = new Set(selectedTargets.flatMap(changeSet => changeSet.changes.map(change => change.filename)));
        const supportingIds = activity
            .filter(entry => !selectedTargetIdsSet.has(entry.id))
            .map(entry => ({ entry, score: scoreActivity(entry, input.focusTerms, targetPaths) }))
            .filter(item => item.score > 0)
            .sort((left, right) => right.score - left.score || right.entry.createdAt.getTime() - left.entry.createdAt.getTime())
            .slice(0, MAX_SUPPORTING_CHANGESETS)
            .map(item => item.entry.id);

        const supportingChangeSets = await this.changeSets.byIds(supportingIds);

        return [
            ...selectedTargets.map(changeSet => ({ role: "TARGET" as const, changeSet })),
            ...supportingChangeSets.map(changeSet => ({ role: "SUPPORTING" as const, changeSet })),
        ].sort((left, right) => left.changeSet.createdAt.getTime() - right.changeSet.createdAt.getTime() || left.changeSet.id.localeCompare(right.changeSet.id));
    }
}

export const workHistoryRetriever = new WorkHistoryRetriever();

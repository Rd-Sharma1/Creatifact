import { sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import type { ActivityMapEntry } from "../../../../domain/types.js";

const ACTIVITY_MAP_LIMIT = 200;

type ActivityMapRow = {
    id: string;
    created_at: Date | string;
    repository_id: string;
    owner: string;
    name: string;
    files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
    commit_messages: string[];
};

export interface ActivityMapReader {
    recent(repositoryId: string): Promise<ActivityMapEntry[]>;
}

export class ActivityMapRepository implements ActivityMapReader {
    async recent(repositoryId: string): Promise<ActivityMapEntry[]> {
        const result = await db.execute<ActivityMapRow>(sql`
            select
                cs.id,
                cs.created_at,
                r.id as repository_id,
                r.owner,
                r.name,
                coalesce((
                    select jsonb_agg(jsonb_build_object(
                        'filename', change_item.value ->> 'filename',
                        'status', change_item.value ->> 'status',
                        'additions', coalesce((change_item.value ->> 'additions')::int, 0),
                        'deletions', coalesce((change_item.value ->> 'deletions')::int, 0)
                    ))
                    from jsonb_array_elements(cs.changes) as change_item(value)
                ), '[]'::jsonb) as files,
                coalesce((
                    select jsonb_agg(commit_item.value -> 'message' #>> '{}')
                    from jsonb_array_elements(cs.commits) as commit_item(value)
                ), '[]'::jsonb) as commit_messages
            from change_sets cs
            inner join repository r on r.id = cs.repository_id
            where cs.repository_id = ${repositoryId}::uuid
            order by cs.created_at desc, cs.id desc
            limit ${ACTIVITY_MAP_LIMIT}
        `);

        return result.rows.map(row => {
            const files = row.files ?? [];
            return {
                id: row.id,
                createdAt: new Date(row.created_at),
                repository: { id: row.repository_id, owner: row.owner, name: row.name },
                files,
                commitMessages: (row.commit_messages ?? []).filter((message): message is string => typeof message === "string"),
                additions: files.reduce((total, file) => total + file.additions, 0),
                deletions: files.reduce((total, file) => total + file.deletions, 0),
            };
        });
    }
}

export const activityMapRepository = new ActivityMapRepository();

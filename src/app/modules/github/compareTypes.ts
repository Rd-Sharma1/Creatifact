export type GitHubCompareResponse = {
    commits?: Array<{
        sha: string;
        html_url: string;
        commit: {
            message: string;
            author?: {
                name?: string | null;
                date?: string | null;
            } | null;
        };
        author?: {
            login?: string | null;
        } | null;
    }>;
    files?: Array<{
        filename: string;
        previous_filename?: string | null;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        patch?: string | null;
    }>;
};

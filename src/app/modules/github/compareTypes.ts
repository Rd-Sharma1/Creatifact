import { z } from "zod";

export const githubCompareResponseSchema = z.object({
    commits: z.array(z.object({
        sha: z.string().min(1),
        html_url: z.url(),
        commit: z.object({
            message: z.string(),
            author: z.object({ name: z.string().nullable().optional(), date: z.string().nullable().optional() }).nullable().optional(),
        }),
        author: z.object({ login: z.string().nullable().optional() }).nullable().optional(),
    })).optional(),
    files: z.array(z.object({
        filename: z.string().min(1),
        previous_filename: z.string().nullable().optional(),
        status: z.string().min(1),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
        changes: z.number().int().nonnegative(),
        patch: z.string().nullable().optional(),
    })).optional(),
});

export type GitHubCompareResponse = z.infer<typeof githubCompareResponseSchema>;

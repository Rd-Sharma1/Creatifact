import getGithubClient from "./GithubAuthService.js";
import type { RetrievedChangeSet } from "../../../domain/types.js";
import { UpstreamProviderError } from "../../common/errors.js";
import { githubCompareResponseSchema } from "./compareTypes.js";

interface RetrieveChangeSetPayload {
    repositoryName: string;
    owner: string;
    base: string;
    head: string;
    basehead: string;
    installationId: number;
}

class GithubServices {
    static async retrieveChangeset({ base, head, basehead, repositoryName, owner, installationId }: RetrieveChangeSetPayload): Promise<RetrievedChangeSet> {
        const octokitClient = getGithubClient(installationId);

        let commitCompareRes: Awaited<ReturnType<typeof octokitClient.request>>;
        try {
            commitCompareRes = await octokitClient.request(
                `GET /repos/${owner}/${repositoryName}/compare/${basehead}`,
                {
                    owner,
                    repo: repositoryName,
                    basehead,
                    headers: {
                        "X-GitHub-Api-Version": "2026-03-10",
                    },
                },
            );
        } catch (error) {
            const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
                ? error.status
                : undefined;
            throw new UpstreamProviderError("GitHub", status, { cause: error });
        }

        const parsed = githubCompareResponseSchema.safeParse(commitCompareRes.data);
        if (!parsed.success) throw new UpstreamProviderError("GitHub");
        const compare = parsed.data;

        const changes = (compare.files ?? []).map(file => ({
            filename: file.filename,
            previousFilename: file.previous_filename ?? null,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch ?? null,
        }));

        const commits = (compare.commits ?? []).map(commit => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
                name: commit.commit.author?.name ?? null,
                username: commit.author?.login ?? null,
            },
            timestamp: commit.commit.author?.date ?? null,
            url: commit.html_url,
        }));

        return {
            base,
            head,
            basehead,
            changes,
            commits,
        };
    }
}

export default GithubServices;

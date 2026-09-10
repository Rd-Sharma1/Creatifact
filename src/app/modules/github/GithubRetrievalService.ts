import getGithubClient from "./GithubAuthService.js";

interface compareCommitsPayload {
    before?: string;
    after?: string;
    repositoryName: string;
    owner: string;
    basehead: string;
    installationId: number;
}

class GithubServices {
    static async compareCommits({ basehead, repositoryName, owner, installationId }: compareCommitsPayload) {
        const octokitClient = getGithubClient(installationId);

        const commitCompareRes = await octokitClient.request(
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

        const changes = commitCompareRes.data.files?.map((file: any) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch,
        }));

        const commits = commitCompareRes.data.commits?.map((commit: any) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.author?.login ?? commit.commit.author?.name,
            timestamp: commit.commit.author?.date,
            url: commit.html_url,
        }));

        return {
            repository: `${owner}/${repositoryName}`,
            basehead,
            changes,
            commits,
        };

        // console.log("CommitCompareRes: ", commitCompareRes);
    }
}

export default GithubServices;

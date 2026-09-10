import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

export default function getGithubClient(installationId: number) {
    return new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: process.env.GITHUB_APP_ID!,
            privateKey: process.env.GITHUB_PRIVATE_KEY!,
            installationId,
        },
    });
}

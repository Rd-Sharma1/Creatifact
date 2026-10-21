import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { ConfigurationError } from "../../common/errors.js";

export default function getGithubClient(installationId: number) {
    const missing = ["GITHUB_APP_ID", "GITHUB_PRIVATE_KEY"].filter(name => !process.env[name]);
    if (missing.length > 0) throw new ConfigurationError({ variables: missing });
    return new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: process.env.GITHUB_APP_ID!,
            privateKey: process.env.GITHUB_PRIVATE_KEY!,
            installationId,
        },
    });
}

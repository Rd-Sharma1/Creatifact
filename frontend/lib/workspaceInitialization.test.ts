import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initializeWorkspace } from "./workspaceInitialization.js";
import type { AuthorizedRepository, CurrentUser } from "./api.js";

const user: CurrentUser = { id: "user-1", githubName: "octocat" };
const repository: AuthorizedRepository = { id: "repo-1", githubRepoId: "1", owner: "octocat", name: "project" };

describe("dashboard workspace initialization", () => {
    it("loads the authenticated user before requesting and exposing repositories", async () => {
        const calls: string[] = [];
        const result = await initializeWorkspace({
            loadCurrentUser: async () => { calls.push("session"); return user; },
            loadRepositories: async () => { calls.push("repositories"); return { repositories: [repository] }; },
        });

        assert.deepEqual(calls, ["session", "repositories"]);
        assert.deepEqual(result, { user, repositories: [repository] });
    });

    it("does not request repositories when the session is unauthenticated", async () => {
        let repositoryRequestStarted = false;
        await assert.rejects(initializeWorkspace({
            loadCurrentUser: async () => { throw new Error("unauthenticated"); },
            loadRepositories: async () => { repositoryRequestStarted = true; return { repositories: [] }; },
        }), /unauthenticated/);
        assert.equal(repositoryRequestStarted, false);
    });

    it("surfaces repository failures so the page can leave its loading state", async () => {
        await assert.rejects(initializeWorkspace({
            loadCurrentUser: async () => user,
            loadRepositories: async () => { throw new Error("repository request failed"); },
        }), /repository request failed/);
    });
});

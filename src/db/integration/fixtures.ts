import { randomBytes, randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { createTestDatabase } from "../testDatabase.js";
import {
    artifactCandidateTable,
    artifactGenerationOutboxTable,
    artifactRequestChangeSetTable,
    artifactRequestTable,
    artifactRequestTypeTable,
    artifactTable,
    authSessionTable,
    changeSetTable,
    repository,
    user,
    user_repository,
} from "../schema.js";

type TestDb = ReturnType<typeof createTestDatabase>["db"];
let githubIdSequence = BigInt(`0x${randomBytes(7).toString("hex")}`);

function nextGithubId(): bigint {
    return githubIdSequence++;
}

export class IntegrationFixture {
    private readonly userIds: string[] = [];
    private readonly repositoryIds: string[] = [];
    private readonly requestIds: string[] = [];
    private readonly changeSetIds: string[] = [];

    constructor(private readonly database: TestDb) {}

    async createUser() {
        const [created] = await this.database.insert(user).values({
            githubUserId: nextGithubId(),
            githubName: `test-${randomUUID()}`,
        }).returning({ id: user.id });
        if (!created) throw new Error("Test user insert returned no ID");
        this.userIds.push(created.id);
        return created.id;
    }

    async createRepository() {
        const [created] = await this.database.insert(repository).values({
            githubRepoId: nextGithubId(),
            owner: "creatifact-test",
            name: `repo-${randomUUID()}`,
        }).returning({ id: repository.id });
        if (!created) throw new Error("Test repository insert returned no ID");
        this.repositoryIds.push(created.id);
        return created.id;
    }

    async grantRepository(userId: string, repositoryId: string): Promise<void> {
        await this.database.insert(user_repository).values({ userId, repositoryId });
    }

    async createRequest(repositoryId: string, status: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED" = "COMPLETED") {
        const [created] = await this.database.insert(artifactRequestTable).values({
            repositoryId,
            status,
            instructions: "Synthetic integration-test request",
            scope: { type: "LATEST" },
        }).returning({ id: artifactRequestTable.id });
        if (!created) throw new Error("Test ArtifactRequest insert returned no ID");
        this.requestIds.push(created.id);
        return created.id;
    }

    async createCandidate(artifactRequestId: string, type: "X_POST" | "LINKEDIN_POST" = "X_POST") {
        const [created] = await this.database.insert(artifactCandidateTable).values({
            artifactRequestId,
            type,
            ordinal: 0,
            angle: "Synthetic test angle",
            content: "Synthetic test content, with no repository data.",
            evidence: [],
            status: "READY",
        }).returning({ id: artifactCandidateTable.id });
        if (!created) throw new Error("Test candidate insert returned no ID");
        return created.id;
    }

    async createChangeSet(repositoryId: string, basehead: string) {
        const [created] = await this.database.insert(changeSetTable).values({
            repositoryId,
            base: "base-sha",
            head: "head-sha",
            basehead,
            changes: [],
            commits: [],
        }).returning({ id: changeSetTable.id });
        if (!created) throw new Error("Test ChangeSet insert returned no ID");
        this.changeSetIds.push(created.id);
        return created.id;
    }

    trackChangeSet(changeSetId: string): void {
        this.changeSetIds.push(changeSetId);
    }

    async cleanup(): Promise<void> {
        if (this.requestIds.length) {
            await this.database.delete(artifactCandidateTable).where(inArray(artifactCandidateTable.artifactRequestId, this.requestIds));
            await this.database.delete(artifactTable).where(inArray(artifactTable.artifactRequestId, this.requestIds));
            await this.database.delete(artifactGenerationOutboxTable).where(inArray(artifactGenerationOutboxTable.artifactRequestId, this.requestIds));
            await this.database.delete(artifactRequestTypeTable).where(inArray(artifactRequestTypeTable.artifactRequestId, this.requestIds));
            await this.database.delete(artifactRequestChangeSetTable).where(inArray(artifactRequestChangeSetTable.artifactRequestId, this.requestIds));
            await this.database.delete(artifactRequestTable).where(inArray(artifactRequestTable.id, this.requestIds));
        }
        if (this.changeSetIds.length) {
            await this.database.delete(artifactRequestChangeSetTable).where(inArray(artifactRequestChangeSetTable.changeSetId, this.changeSetIds));
            await this.database.delete(changeSetTable).where(inArray(changeSetTable.id, this.changeSetIds));
        }
        if (this.repositoryIds.length) {
            await this.database.delete(user_repository).where(inArray(user_repository.repositoryId, this.repositoryIds));
            await this.database.delete(repository).where(inArray(repository.id, this.repositoryIds));
        }
        if (this.userIds.length) {
            await this.database.delete(authSessionTable).where(inArray(authSessionTable.userId, this.userIds));
            await this.database.delete(user_repository).where(inArray(user_repository.userId, this.userIds));
            await this.database.delete(user).where(inArray(user.id, this.userIds));
        }
    }
}

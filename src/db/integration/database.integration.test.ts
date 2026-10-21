import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { authenticateSession, createSession } from "../../app/modules/auth/githubAuth.js";
import { userHasRepositoryAccess } from "../../app/modules/auth/repositoryAuthorization.js";
import { persistChangeSet } from "../../app/modules/changeset/persist.js";
import { selectArtifactCandidate } from "../../app/modules/artifact-request/ArtifactCandidateService.js";
import { ArtifactGenerationOutboxService } from "../../app/modules/artifact-request/ArtifactGenerationOutboxService.js";
import { artifactGenerationOutboxTable, artifactTable, authSessionTable } from "../schema.js";
import { createTestDatabase } from "../testDatabase.js";
import { IntegrationFixture } from "./fixtures.js";

const testDatabase = createTestDatabase();
const database = testDatabase.db;

describe("isolated PostgreSQL integration", () => {
    before(async () => {
        await database.execute(sql`select 1`);
    });

    after(async () => {
        await testDatabase.close();
    });

    it("persists sessions and rejects them after database expiry", async t => {
        const fixture = new IntegrationFixture(database);
        t.after(() => fixture.cleanup());
        const userId = await fixture.createUser();
        const token = await createSession(userId, database);

        assert.equal(await authenticateSession(token, database), userId);
        const [session] = await database.select({ id: authSessionTable.id }).from(authSessionTable)
            .where(eq(authSessionTable.userId, userId));
        assert.ok(session);
        await database.update(authSessionTable).set({ expiresAt: new Date(Date.now() - 1_000) })
            .where(eq(authSessionTable.id, session.id));
        assert.equal(await authenticateSession(token, database), undefined);
    });

    it("isolates repository access to the user with an explicit grant", async t => {
        const fixture = new IntegrationFixture(database);
        t.after(() => fixture.cleanup());
        const ownerId = await fixture.createUser();
        const otherUserId = await fixture.createUser();
        const repositoryId = await fixture.createRepository();
        await fixture.grantRepository(ownerId, repositoryId);

        assert.equal(await userHasRepositoryAccess(ownerId, repositoryId, database), true);
        assert.equal(await userHasRepositoryAccess(otherUserId, repositoryId, database), false);
    });

    it("returns the same ChangeSet for duplicate repository/range persistence", async t => {
        const fixture = new IntegrationFixture(database);
        t.after(() => fixture.cleanup());
        const repositoryId = await fixture.createRepository();
        const changeSet = {
            repositoryId,
            base: "synthetic-base",
            head: "synthetic-head",
            basehead: `synthetic-${randomUUID()}`,
            commits: [],
            changes: [],
        };

        const first = await persistChangeSet(changeSet, database);
        const second = await persistChangeSet(changeSet, database);

        assert.ok(first);
        fixture.trackChangeSet(first);
        assert.equal(second, first);
    });

    it("selects the same candidate idempotently and keeps one final Artifact", async t => {
        const fixture = new IntegrationFixture(database);
        t.after(() => fixture.cleanup());
        const repositoryId = await fixture.createRepository();
        const requestId = await fixture.createRequest(repositoryId);
        const candidateId = await fixture.createCandidate(requestId);

        const first = await selectArtifactCandidate({ artifactRequestId: requestId, candidateId }, database);
        const second = await selectArtifactCandidate({ artifactRequestId: requestId, candidateId }, database);
        const artifacts = await database.select().from(artifactTable).where(eq(artifactTable.artifactRequestId, requestId));

        assert.equal(first.kind, "selected");
        assert.equal(second.kind, "selected");
        if (first.kind === "selected" && second.kind === "selected") assert.equal(second.artifact.id, first.artifact.id);
        assert.equal(artifacts.length, 1);
    });

    it("persists outbox attempts and delivery state", async t => {
        const fixture = new IntegrationFixture(database);
        t.after(() => fixture.cleanup());
        const repositoryId = await fixture.createRepository();
        const requestId = await fixture.createRequest(repositoryId, "PENDING");
        const [event] = await database.insert(artifactGenerationOutboxTable).values({ artifactRequestId: requestId }).returning();
        assert.ok(event);
        const outbox = new ArtifactGenerationOutboxService(database);

        assert.ok((await outbox.pending(100_000)).some(row => row.id === event.id));
        await outbox.recordAttempt([event.id]);
        await outbox.markDelivered([event.id]);

        assert.equal((await outbox.pending(100_000)).some(row => row.id === event.id), false);
        const [persisted] = await database.select().from(artifactGenerationOutboxTable)
            .where(eq(artifactGenerationOutboxTable.id, event.id));
        assert.equal(persisted?.attempts, 1);
        assert.ok(persisted?.deliveredAt);
    });
});

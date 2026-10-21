import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { AuthenticationError, AuthorizationError, ConflictError, ConfigurationError, RequestValidationError, UpstreamProviderError } from "../../common/errors.js";
import { db } from "../../../db/index.js";
import {
    authSessionTable,
    githubInstallationRepositoryTable,
    githubInstallationTable,
    githubOAuthStateTable,
    repository,
    user,
    user_repository,
} from "../../../db/schema.js";

const GITHUB_API = "https://api.github.com";
const SESSION_COOKIE = "creatifact_session";
const STATE_COOKIE = "creatifact_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const githubIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const githubUserSchema = z.object({ id: githubIdSchema, login: z.string().min(1).max(100) });
const githubInstallationsSchema = z.object({
    total_count: z.number().int().nonnegative(),
    installations: z.array(z.object({
        id: githubIdSchema,
        app_id: githubIdSchema,
        suspended_at: z.string().nullable().optional(),
        account: z.object({ id: githubIdSchema, login: z.string().min(1).max(100), type: z.string() }),
    })),
});
const githubRepositoriesSchema = z.object({
    total_count: z.number().int().nonnegative(),
    repositories: z.array(z.object({
        id: githubIdSchema,
        name: z.string().min(1).max(100),
        owner: z.object({ login: z.string().min(1).max(100) }),
    })),
});

export type GithubOAuthIntent = "LOGIN" | "INSTALL";

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new ConfigurationError({ variables: [name] });
    return value;
}

function digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function secureCookie(): boolean {
    return process.env.AUTH_COOKIE_SECURE !== "false";
}

function cookie(value: string, maxAgeSeconds: number, httpOnly: boolean): string {
    return `${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${httpOnly ? "; HttpOnly" : ""}${secureCookie() ? "; Secure" : ""}`;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return undefined;
}

export function oauthStateMatches(a: string | undefined, b: string | undefined): boolean {
    if (!a || !b) return false;
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}

export function findVerifiedInstallation(
    installations: z.infer<typeof githubInstallationsSchema>["installations"],
    installationId: number,
    appId: number,
) {
    return installations.find(item => item.id === installationId && item.app_id === appId && !item.suspended_at);
}

export async function createOAuthFlow(intent: GithubOAuthIntent, userId?: string): Promise<{ state: string; authorizationUrl: string }> {
    const state = randomBytes(32).toString("base64url");
    await db.delete(githubOAuthStateTable).where(sql`${githubOAuthStateTable.expiresAt} <= now()`);
    await db.insert(githubOAuthStateTable).values({
        stateHash: digest(state),
        intent,
        userId: userId ?? null,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    });

    const clientId = requiredEnv("GITHUB_APP_CLIENT_ID");
    const callbackUrl = requiredEnv("GITHUB_APP_CALLBACK_URL");
    const url = intent === "LOGIN"
        ? new URL("https://github.com/login/oauth/authorize")
        : new URL(`https://github.com/apps/${encodeURIComponent(requiredEnv("GITHUB_APP_SLUG"))}/installations/new`);
    if (intent === "LOGIN") {
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
    }
    url.searchParams.set("state", state);
    return { state, authorizationUrl: url.toString() };
}

export async function consumeOAuthFlow(state: string, cookieState: string | undefined) {
    if (!oauthStateMatches(state, cookieState)) return undefined;
    return db.transaction(async tx => {
        const [flow] = await tx.select().from(githubOAuthStateTable)
            .where(eq(githubOAuthStateTable.stateHash, digest(state))).for("update");
        if (!flow || flow.consumedAt || flow.expiresAt <= new Date()) return undefined;
        await tx.update(githubOAuthStateTable).set({ consumedAt: new Date() })
            .where(eq(githubOAuthStateTable.stateHash, flow.stateHash));
        return flow;
    });
}

async function githubJson<T>(url: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    } catch (error) {
        throw new UpstreamProviderError("GitHub", undefined, { cause: error });
    }
    if (!response.ok) throw new UpstreamProviderError("GitHub", response.status);
    let body: unknown;
    try {
        body = await response.json();
    } catch (error) {
        throw new UpstreamProviderError("GitHub", response.status, { cause: error });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new UpstreamProviderError("GitHub", response.status);
    return parsed.data;
}

async function exchangeCode(code: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: requiredEnv("GITHUB_APP_CLIENT_ID"),
                client_secret: requiredEnv("GITHUB_APP_CLIENT_SECRET"),
                code,
            }),
            signal: AbortSignal.timeout(12_000),
        });
    } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        throw new UpstreamProviderError("GitHub", undefined, { cause: error });
    }
    if (!response.ok) throw new UpstreamProviderError("GitHub", response.status);
    let body: unknown;
    try {
        body = await response.json();
    } catch (error) {
        throw new UpstreamProviderError("GitHub", response.status, { cause: error });
    }
    const parsed = z.object({ access_token: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw new UpstreamProviderError("GitHub", response.status);
    return parsed.data.access_token;
}

async function getGithubUser(accessToken: string) {
    return githubJson(`${GITHUB_API}/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    }, githubUserSchema);
}

async function upsertUser(githubUser: z.infer<typeof githubUserSchema>) {
    const [result] = await db.insert(user).values({ githubUserId: BigInt(githubUser.id), githubName: githubUser.login })
        .onConflictDoUpdate({ target: user.githubUserId, set: { githubName: githubUser.login } }).returning();
    if (!result) throw new Error("Could not persist GitHub user");
    return result;
}

export async function createSession(userId: string, database: typeof db = db): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await database.insert(authSessionTable).values({ tokenHash: digest(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return token;
}

export async function authenticateSession(token: string | undefined, database: typeof db = db): Promise<string | undefined> {
    if (!token) return undefined;
    const [session] = await database.select({ userId: authSessionTable.userId }).from(authSessionTable)
        .where(and(eq(authSessionTable.tokenHash, digest(token)), isNull(authSessionTable.revokedAt), gt(authSessionTable.expiresAt, new Date())));
    return session?.userId;
}

export async function revokeSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await db.update(authSessionTable).set({ revokedAt: new Date() })
        .where(and(eq(authSessionTable.tokenHash, digest(token)), isNull(authSessionTable.revokedAt)));
}

async function listUserInstallations(accessToken: string) {
    const results: z.infer<typeof githubInstallationsSchema>["installations"] = [];
    for (let page = 1; ; page += 1) {
        const response = await githubJson(`${GITHUB_API}/user/installations?per_page=100&page=${page}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        }, githubInstallationsSchema);
        results.push(...response.installations);
        if (results.length >= response.total_count || response.installations.length === 0) return results;
    }
}

async function listInstallationRepositories(accessToken: string, installationId: number) {
    const results: z.infer<typeof githubRepositoriesSchema>["repositories"] = [];
    let expected = 0;
    for (let page = 1; ; page += 1) {
        const response = await githubJson(`${GITHUB_API}/user/installations/${installationId}/repositories?per_page=100&page=${page}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        }, githubRepositoriesSchema);
        expected = response.total_count;
        results.push(...response.repositories);
        if (results.length >= expected || response.repositories.length === 0) return results;
    }
}

export async function syncVerifiedInstallation(userId: string, accessToken: string, installationId: number): Promise<void> {
    const installations = await listUserInstallations(accessToken);
    const verified = findVerifiedInstallation(installations, installationId, Number(requiredEnv("GITHUB_APP_ID")));
    if (!verified) throw new AuthorizationError("The installation is not available to this GitHub user");
    const repositories = await listInstallationRepositories(accessToken, installationId);

    await db.transaction(async tx => {
        const [existing] = await tx.select().from(githubInstallationTable)
            .where(eq(githubInstallationTable.githubInstallationId, BigInt(installationId))).for("update");
        if (existing?.userId && existing.userId !== userId) throw new ConflictError("This installation is already linked to another Creatifact user");
        const [installation] = existing
            ? await tx.update(githubInstallationTable).set({
                userId, accountGithubId: BigInt(verified.account.id), accountLogin: verified.account.login,
                accountType: verified.account.type, suspendedAt: null, updatedAt: new Date(),
            }).where(eq(githubInstallationTable.id, existing.id)).returning()
            : await tx.insert(githubInstallationTable).values({
                githubInstallationId: BigInt(installationId), userId,
                accountGithubId: BigInt(verified.account.id), accountLogin: verified.account.login, accountType: verified.account.type,
            }).onConflictDoNothing({ target: githubInstallationTable.githubInstallationId }).returning();
        const resolvedInstallation = installation ?? (await tx.select().from(githubInstallationTable)
            .where(eq(githubInstallationTable.githubInstallationId, BigInt(installationId))))[0];
        if (!resolvedInstallation || resolvedInstallation.userId !== userId) throw new ConflictError("Installation ownership changed during synchronization");

        const oldLinks = await tx.select({ repositoryId: githubInstallationRepositoryTable.repositoryId })
            .from(githubInstallationRepositoryTable).where(eq(githubInstallationRepositoryTable.installationId, resolvedInstallation.id));
        await tx.delete(githubInstallationRepositoryTable).where(eq(githubInstallationRepositoryTable.installationId, resolvedInstallation.id));

        const repositoryIds: string[] = [];
        for (const item of repositories) {
            const [repo] = await tx.insert(repository).values({ githubRepoId: BigInt(item.id), owner: item.owner.login, name: item.name })
                .onConflictDoUpdate({ target: repository.githubRepoId, set: { owner: item.owner.login, name: item.name } }).returning({ id: repository.id });
            if (!repo) throw new Error("Could not persist an authorized repository");
            repositoryIds.push(repo.id);
        }
        if (repositoryIds.length > 0) {
            await tx.insert(githubInstallationRepositoryTable).values(repositoryIds.map(repositoryId => ({
                installationId: resolvedInstallation.id, repositoryId,
            })));
            await tx.insert(user_repository).values(repositoryIds.map(repositoryId => ({ userId, repositoryId }))).onConflictDoNothing();
        }

        const current = new Set(repositoryIds);
        for (const old of oldLinks) {
            if (current.has(old.repositoryId)) continue;
            const [anotherGrant] = await tx.select({ id: githubInstallationRepositoryTable.installationId })
                .from(githubInstallationRepositoryTable)
                .innerJoin(githubInstallationTable, eq(githubInstallationTable.id, githubInstallationRepositoryTable.installationId))
                .where(and(
                    eq(githubInstallationRepositoryTable.repositoryId, old.repositoryId),
                    eq(githubInstallationTable.userId, userId),
                    isNull(githubInstallationTable.suspendedAt),
                )).limit(1);
            if (!anotherGrant) await tx.delete(user_repository).where(and(
                eq(user_repository.userId, userId), eq(user_repository.repositoryId, old.repositoryId),
            ));
        }
    });
}

async function syncInstallationsAvailableToUser(userId: string, accessToken: string): Promise<number> {
    const installations = await listUserInstallations(accessToken);
    const appId = Number(requiredEnv("GITHUB_APP_ID"));
    const available = installations.filter(item => item.app_id === appId && !item.suspended_at);
    let linkedCount = 0;
    for (const installation of available) {
        const [existing] = await db.select({ userId: githubInstallationTable.userId })
            .from(githubInstallationTable)
            .where(eq(githubInstallationTable.githubInstallationId, BigInt(installation.id)));
        if (existing?.userId && existing.userId !== userId) continue;
        await syncVerifiedInstallation(userId, accessToken, installation.id);
        linkedCount += 1;
    }
    return linkedCount;
}

export async function handleInstallationWebhook(input:
    | { action: "created"; installation: { id: number; app_id: number; account: { id: number; login: string; type: string } } }
    | { action: "deleted"; installationId: number }
    | { action: "suspended" | "unsuspended" | "permission_updated"; installationId: number }
    | { action: "repositories_added" | "repositories_removed"; installationId: number; repositories: Array<{ id: number; name?: string; owner?: { login: string } }> },
): Promise<void> {
    await db.transaction(async tx => {
        if (input.action === "created") {
            if (input.installation.app_id !== Number(requiredEnv("GITHUB_APP_ID"))) return;
            const [existing] = await tx.select({ id: githubInstallationTable.id })
                .from(githubInstallationTable).where(eq(githubInstallationTable.githubInstallationId, BigInt(input.installation.id)));
            if (existing) {
                await tx.update(githubInstallationTable).set({
                    accountGithubId: BigInt(input.installation.account.id), accountLogin: input.installation.account.login,
                    accountType: input.installation.account.type, updatedAt: new Date(),
                }).where(eq(githubInstallationTable.id, existing.id));
            } else {
                await tx.insert(githubInstallationTable).values({
                    githubInstallationId: BigInt(input.installation.id), userId: null,
                    accountGithubId: BigInt(input.installation.account.id), accountLogin: input.installation.account.login,
                    accountType: input.installation.account.type,
                }).onConflictDoNothing();
            }
            return;
        }

        const [installation] = await tx.select().from(githubInstallationTable)
            .where(eq(githubInstallationTable.githubInstallationId, BigInt(input.installationId))).for("update");
        if (!installation) return;
        const linkedRepositories = await tx.select({ repositoryId: githubInstallationRepositoryTable.repositoryId })
            .from(githubInstallationRepositoryTable).where(eq(githubInstallationRepositoryTable.installationId, installation.id));

        if (input.action === "suspended" || input.action === "unsuspended" || input.action === "permission_updated") {
            const suspendedAt = input.action === "suspended" ? new Date() : input.action === "unsuspended" ? null : installation.suspendedAt;
            await tx.update(githubInstallationTable).set({ suspendedAt, updatedAt: new Date() })
                .where(eq(githubInstallationTable.id, installation.id));
            if (installation.userId && input.action !== "permission_updated") {
                for (const linked of linkedRepositories) {
                    if (input.action === "unsuspended") {
                        await tx.insert(user_repository).values({ userId: installation.userId, repositoryId: linked.repositoryId }).onConflictDoNothing();
                    } else {
                        const [other] = await tx.select({ id: githubInstallationRepositoryTable.installationId })
                            .from(githubInstallationRepositoryTable)
                            .innerJoin(githubInstallationTable, eq(githubInstallationTable.id, githubInstallationRepositoryTable.installationId))
                            .where(and(
                                eq(githubInstallationRepositoryTable.repositoryId, linked.repositoryId),
                                eq(githubInstallationTable.userId, installation.userId),
                                ne(githubInstallationTable.id, installation.id),
                                isNull(githubInstallationTable.suspendedAt),
                            )).limit(1);
                        if (!other) await tx.delete(user_repository).where(and(
                            eq(user_repository.userId, installation.userId), eq(user_repository.repositoryId, linked.repositoryId),
                        ));
                    }
                }
            }
            return;
        }

        if (input.action === "deleted") {
            await tx.delete(githubInstallationRepositoryTable).where(eq(githubInstallationRepositoryTable.installationId, installation.id));
            if (installation.userId) {
                for (const linked of linkedRepositories) {
                    const [other] = await tx.select({ id: githubInstallationRepositoryTable.installationId })
                        .from(githubInstallationRepositoryTable)
                        .innerJoin(githubInstallationTable, eq(githubInstallationTable.id, githubInstallationRepositoryTable.installationId))
                        .where(and(
                            eq(githubInstallationRepositoryTable.repositoryId, linked.repositoryId),
                            eq(githubInstallationTable.userId, installation.userId),
                            isNull(githubInstallationTable.suspendedAt),
                        )).limit(1);
                    if (!other) await tx.delete(user_repository).where(and(
                        eq(user_repository.userId, installation.userId), eq(user_repository.repositoryId, linked.repositoryId),
                    ));
                }
            }
            await tx.delete(githubInstallationTable).where(eq(githubInstallationTable.id, installation.id));
            return;
        }

        if (input.action === "repositories_added") {
            for (const item of input.repositories) {
                if (!item.name || !item.owner?.login) continue;
                const [repo] = await tx.insert(repository).values({ githubRepoId: BigInt(item.id), owner: item.owner.login, name: item.name })
                    .onConflictDoUpdate({ target: repository.githubRepoId, set: { owner: item.owner.login, name: item.name } })
                    .returning({ id: repository.id });
                if (!repo) continue;
                await tx.insert(githubInstallationRepositoryTable).values({ installationId: installation.id, repositoryId: repo.id }).onConflictDoNothing();
                if (installation.userId && !installation.suspendedAt) {
                    await tx.insert(user_repository).values({ userId: installation.userId, repositoryId: repo.id }).onConflictDoNothing();
                }
            }
        } else if (input.action === "repositories_removed") {
            for (const item of input.repositories) {
                const [link] = await tx.select({ repositoryId: githubInstallationRepositoryTable.repositoryId })
                    .from(githubInstallationRepositoryTable).innerJoin(repository, eq(repository.id, githubInstallationRepositoryTable.repositoryId))
                    .where(and(
                        eq(githubInstallationRepositoryTable.installationId, installation.id),
                        eq(repository.githubRepoId, BigInt(item.id)),
                    ));
                if (!link) continue;
                await tx.delete(githubInstallationRepositoryTable).where(and(
                    eq(githubInstallationRepositoryTable.installationId, installation.id),
                    eq(githubInstallationRepositoryTable.repositoryId, link.repositoryId),
                ));
                if (installation.userId) {
                    const [other] = await tx.select({ id: githubInstallationRepositoryTable.installationId })
                        .from(githubInstallationRepositoryTable)
                        .innerJoin(githubInstallationTable, eq(githubInstallationTable.id, githubInstallationRepositoryTable.installationId))
                        .where(and(
                            eq(githubInstallationRepositoryTable.repositoryId, link.repositoryId),
                            eq(githubInstallationTable.userId, installation.userId),
                            isNull(githubInstallationTable.suspendedAt),
                        )).limit(1);
                    if (!other) await tx.delete(user_repository).where(and(
                        eq(user_repository.userId, installation.userId), eq(user_repository.repositoryId, link.repositoryId),
                    ));
                }
            }
        }
    });
}

export async function completeGithubCallback(input: { code: string; state: string; cookieState?: string; installationId?: number; currentUserId?: string }) {
    const flow = await consumeOAuthFlow(input.state, input.cookieState);
    if (!flow) throw new AuthenticationError("GitHub authorization could not be completed");
    if (flow.intent === "INSTALL" && (!flow.userId || flow.userId !== input.currentUserId)) throw new AuthorizationError("Installation flow user changed");
    if (flow.intent === "LOGIN" && flow.userId) throw new AuthenticationError("GitHub authorization could not be completed");

    const accessToken = await exchangeCode(input.code);
    const githubUser = await getGithubUser(accessToken);
    if (flow.intent === "INSTALL") {
        if (!flow.userId || input.currentUserId !== flow.userId) throw new AuthorizationError("Installation must be completed by the signed-in user");
        const [current] = await db.select({ id: user.id, githubUserId: user.githubUserId }).from(user).where(eq(user.id, flow.userId));
        if (!current || !isSameGithubUser(current.githubUserId, githubUser.id)) throw new AuthorizationError("Installation must be authorized by the same GitHub user");
        const account = await upsertUser(githubUser);
        if (!input.installationId) throw new RequestValidationError(undefined, "GitHub did not provide an installation identifier");
        await syncVerifiedInstallation(flow.userId, accessToken, input.installationId);
        return { intent: flow.intent, userId: account.id };
    }
    const account = await upsertUser(githubUser);
    const linkedInstallations = await syncInstallationsAvailableToUser(account.id, accessToken);
    return { intent: flow.intent, userId: account.id, sessionToken: await createSession(account.id), linkedInstallations };
}

export function isSameGithubUser(storedGithubUserId: bigint | null, callbackGithubUserId: number): boolean {
    return storedGithubUserId !== null && storedGithubUserId === BigInt(callbackGithubUserId);
}

export function sessionCookie(token: string): string {
    return cookie(`${SESSION_COOKIE}=${token}`, SESSION_TTL_MS / 1000, true);
}

export function clearSessionCookie(): string {
    return cookie(`${SESSION_COOKIE}=`, 0, true);
}

export function oauthStateCookie(state: string): string {
    return cookie(`${STATE_COOKIE}=${state}`, OAUTH_STATE_TTL_MS / 1000, true);
}

export function clearOAuthStateCookie(): string {
    return cookie(`${STATE_COOKIE}=`, 0, true);
}

export const authCookieNames = { session: SESSION_COOKIE, state: STATE_COOKIE } as const;

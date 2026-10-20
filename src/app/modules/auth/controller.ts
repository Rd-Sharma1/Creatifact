import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../../db/index.js";
import { user, user_repository, repository } from "../../../db/schema.js";
import { eq } from "drizzle-orm";
import { createOAuthFlow, completeGithubCallback, clearOAuthStateCookie, clearSessionCookie, oauthStateCookie, readCookie, revokeSession, sessionCookie, authCookieNames, authenticateSession } from "./githubAuth.js";

const callbackQuerySchema = z.object({
    code: z.string().min(1).max(512),
    state: z.string().min(20).max(256),
    installation_id: z.string().regex(/^\d+$/).refine(value => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)).optional(),
});

export async function startGithubLogin(_req: Request, res: Response): Promise<void> {
    try {
        const flow = await createOAuthFlow("LOGIN");
        res.setHeader("Set-Cookie", oauthStateCookie(flow.state));
        res.redirect(302, flow.authorizationUrl);
    } catch {
        res.status(503).json({ error: "GitHub sign-in is not configured" });
    }
}

export async function startGithubInstallation(_req: Request, res: Response): Promise<void> {
    try {
        const flow = await createOAuthFlow("INSTALL", res.locals.userId as string);
        res.setHeader("Set-Cookie", oauthStateCookie(flow.state));
        res.redirect(303, flow.authorizationUrl);
    } catch {
        res.status(503).json({ error: "GitHub App installation is not configured" });
    }
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
    res.setHeader("Set-Cookie", clearOAuthStateCookie());
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid GitHub authorization callback" });
        return;
    }
    try {
        const currentUserId = await authenticateSession(readCookie(req.headers.cookie, authCookieNames.session));
        const installationId = parsed.data.installation_id ? Number(parsed.data.installation_id) : undefined;
        const cookieState = readCookie(req.headers.cookie, authCookieNames.state);
        const result = await completeGithubCallback({
            code: parsed.data.code,
            state: parsed.data.state,
            ...(cookieState ? { cookieState } : {}),
            ...(installationId ? { installationId } : {}),
            ...(currentUserId ? { currentUserId } : {}),
        });
        if (result.sessionToken) res.append("Set-Cookie", sessionCookie(result.sessionToken));
        const linkedInstallations = result.intent === "LOGIN" ? result.linkedInstallations ?? 0 : 1;
        res.status(200).json({
            authenticated: true,
            userId: result.userId,
            installationLinked: linkedInstallations > 0,
            linkedInstallations,
        });
    } catch {
        res.status(400).json({ error: "GitHub authorization could not be completed" });
    }
}

export async function logout(req: Request, res: Response): Promise<void> {
    await revokeSession(readCookie(req.headers.cookie, authCookieNames.session));
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(204).end();
}

export async function currentUser(_req: Request, res: Response): Promise<void> {
    const userId = res.locals.userId as string;
    const [current] = await db.select({ id: user.id, githubName: user.githubName }).from(user).where(eq(user.id, userId));
    if (!current) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    res.status(200).json(current);
}

export async function listAuthorizedRepositories(_req: Request, res: Response): Promise<void> {
    const userId = res.locals.userId as string;
    const repositories = await db.select({ id: repository.id, githubRepoId: repository.githubRepoId, owner: repository.owner, name: repository.name })
        .from(user_repository).innerJoin(repository, eq(repository.id, user_repository.repositoryId))
        .where(eq(user_repository.userId, userId));
    res.status(200).json({ repositories: repositories.map(item => ({ ...item, githubRepoId: item.githubRepoId.toString() })) });
}

import type { Request, Response } from "express";
import { z } from "zod";
import { AuthenticationError } from "../../common/errors.js";
import { parseOrThrow } from "../../common/validation.js";
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
    const flow = await createOAuthFlow("LOGIN");
    res.setHeader("Set-Cookie", oauthStateCookie(flow.state));
    res.redirect(302, flow.authorizationUrl);
}

export async function startGithubInstallation(_req: Request, res: Response): Promise<void> {
    const flow = await createOAuthFlow("INSTALL", res.locals.userId as string);
    res.setHeader("Set-Cookie", oauthStateCookie(flow.state));
    res.redirect(303, flow.authorizationUrl);
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
    res.setHeader("Set-Cookie", clearOAuthStateCookie());
    const callback = parseOrThrow(callbackQuerySchema, req.query);
    const currentUserId = await authenticateSession(readCookie(req.headers.cookie, authCookieNames.session));
    const installationId = callback.installation_id ? Number(callback.installation_id) : undefined;
    const cookieState = readCookie(req.headers.cookie, authCookieNames.state);
    const result = await completeGithubCallback({
        code: callback.code,
        state: callback.state,
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
        throw new AuthenticationError();
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

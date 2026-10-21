import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { artifactRequestTable, user_repository } from "../../../db/schema.js";
import { AuthenticationError, AuthorizationError, NotFoundError } from "../../common/errors.js";
import { parseOrThrow } from "../../common/validation.js";
import { authCookieNames, authenticateSession, readCookie } from "./githubAuth.js";
import { userHasRepositoryAccess } from "./repositoryAuthorization.js";
import { artifactRequestCreateSchema, artifactRequestParamsSchema } from "../artifact-request/schema.js";

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = readCookie(req.headers.cookie, authCookieNames.session);
    const userId = await authenticateSession(token);
    if (!userId) throw new AuthenticationError();
    res.locals.userId = userId;
    next();
}

export function protectUnsafeRequests(req: Request, _res: Response, next: NextFunction): void {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        next();
        return;
    }
    const expectedOrigin = process.env.APP_ORIGIN;
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin, expectedOrigin)) {
        throw new AuthorizationError("Request origin is not allowed");
    }
    next();
}

export function isAllowedOrigin(origin: string | undefined, expectedOrigin: string | undefined): boolean {
    if (!origin || !expectedOrigin) return false;
    try {
        return origin === new URL(expectedOrigin).origin;
    } catch {
        return false;
    }
}

export async function authorizeArtifactRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { artifactRequestId } = parseOrThrow(artifactRequestParamsSchema, req.params);
    res.locals.artifactRequestId = artifactRequestId;
    const userId = res.locals.userId as string | undefined;
    if (!userId) throw new AuthenticationError();
    const [access] = await db.select({ id: artifactRequestTable.id }).from(artifactRequestTable)
        .innerJoin(user_repository, eq(user_repository.repositoryId, artifactRequestTable.repositoryId))
        .where(and(eq(artifactRequestTable.id, artifactRequestId), eq(user_repository.userId, userId)));
    if (!access) throw new NotFoundError("ArtifactRequest not found");
    next();
}

export async function authorizeRepositoryBody(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input = parseOrThrow(artifactRequestCreateSchema, req.body);
    res.locals.artifactRequestInput = input;
    const repositoryId = input.repositoryId;
    const userId = res.locals.userId as string | undefined;
    if (!userId) throw new AuthenticationError();
    if (!await userHasRepositoryAccess(userId, repositoryId)) throw new NotFoundError("Repository not found");
    next();
}

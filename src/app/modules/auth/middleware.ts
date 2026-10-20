import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db/index.js";
import { artifactRequestTable, repository, user_repository } from "../../../db/schema.js";
import { authCookieNames, authenticateSession, readCookie } from "./githubAuth.js";

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const token = readCookie(req.headers.cookie, authCookieNames.session);
        const userId = await authenticateSession(token);
        if (!userId) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        res.locals.userId = userId;
        next();
    } catch {
        res.status(500).json({ error: "Could not validate session" });
    }
}

export function protectUnsafeRequests(req: Request, res: Response, next: NextFunction): void {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        next();
        return;
    }
    const expectedOrigin = process.env.APP_ORIGIN;
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin, expectedOrigin)) {
        res.status(403).json({ error: "Request origin is not allowed" });
        return;
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
    try {
        const { artifactRequestId } = req.params;
        const userId = res.locals.userId as string | undefined;
        if (typeof artifactRequestId !== "string" || !z.uuid().safeParse(artifactRequestId).success) {
            res.status(400).json({ error: "Invalid ArtifactRequest ID" });
            return;
        }
        if (!userId) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const [access] = await db.select({ id: artifactRequestTable.id }).from(artifactRequestTable)
            .innerJoin(user_repository, eq(user_repository.repositoryId, artifactRequestTable.repositoryId))
            .where(and(eq(artifactRequestTable.id, artifactRequestId), eq(user_repository.userId, userId)));
        if (!access) {
            res.status(404).json({ error: "ArtifactRequest not found" });
            return;
        }
        next();
    } catch {
        res.status(500).json({ error: "Could not authorize ArtifactRequest" });
    }
}

export async function authorizeRepositoryBody(req: Request, res: Response, next: NextFunction): Promise<void> {
    const repositoryId = req.body && typeof req.body === "object" ? req.body.repositoryId : undefined;
    const userId = res.locals.userId as string | undefined;
    if (typeof repositoryId !== "string" || !userId) {
        next(); // The controller returns the boundary validation error.
        return;
    }
    if (!z.uuid().safeParse(repositoryId).success) {
        next();
        return;
    }
    try {
        const [access] = await db.select({ id: repository.id }).from(repository)
            .innerJoin(user_repository, eq(user_repository.repositoryId, repository.id))
            .where(and(eq(repository.id, repositoryId), eq(user_repository.userId, userId)));
        if (!access) {
            res.status(404).json({ error: "Repository not found" });
            return;
        }
        next();
    } catch {
        res.status(500).json({ error: "Could not authorize repository" });
    }
}

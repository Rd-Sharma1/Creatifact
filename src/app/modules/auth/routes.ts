import express from "express";
import type { Router } from "express";
import { currentUser, githubCallback, listAuthorizedRepositories, logout, startGithubInstallation, startGithubLogin } from "./controller.js";
import { protectUnsafeRequests, requireSession } from "./middleware.js";

export const authRouter: Router = express.Router();
export const repositoryRouter: Router = express.Router();

authRouter.get("/github", startGithubLogin);
authRouter.get("/github/callback", githubCallback);
authRouter.get("/me", requireSession, currentUser);
authRouter.post("/github/install", requireSession, protectUnsafeRequests, startGithubInstallation);
authRouter.post("/logout", requireSession, protectUnsafeRequests, logout);
repositoryRouter.get("/", requireSession, listAuthorizedRepositories);

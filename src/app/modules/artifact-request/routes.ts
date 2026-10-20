import type { Router } from "express";
import express from "express";
import {
    createArtifactRequestController,
    discardArtifactCandidateController,
    editArtifactCandidateController,
    getArtifactRequestController,
    selectArtifactCandidateController,
} from "./controller.js";
import { authorizeArtifactRequest, authorizeRepositoryBody, protectUnsafeRequests, requireSession } from "../auth/middleware.js";

const artifactRequestRouter: Router = express.Router();

artifactRequestRouter.use(requireSession, protectUnsafeRequests);
artifactRequestRouter.post("/", authorizeRepositoryBody, createArtifactRequestController);
artifactRequestRouter.get("/:artifactRequestId", authorizeArtifactRequest, getArtifactRequestController);
artifactRequestRouter.patch("/:artifactRequestId/candidates/:candidateId", authorizeArtifactRequest, editArtifactCandidateController);
artifactRequestRouter.post("/:artifactRequestId/candidates/:candidateId/select", authorizeArtifactRequest, selectArtifactCandidateController);
artifactRequestRouter.post("/:artifactRequestId/candidates/:candidateId/discard", authorizeArtifactRequest, discardArtifactCandidateController);

export { artifactRequestRouter };

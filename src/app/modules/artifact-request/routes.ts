import type { Router } from "express";
import express from "express";
import {
    createArtifactRequestController,
    discardArtifactCandidateController,
    editArtifactCandidateController,
    getArtifactRequestController,
    selectArtifactCandidateController,
} from "./controller.js";

const artifactRequestRouter: Router = express.Router();

artifactRequestRouter.post("/", createArtifactRequestController);
artifactRequestRouter.get("/:artifactRequestId", getArtifactRequestController);
artifactRequestRouter.patch("/:artifactRequestId/candidates/:candidateId", editArtifactCandidateController);
artifactRequestRouter.post("/:artifactRequestId/candidates/:candidateId/select", selectArtifactCandidateController);
artifactRequestRouter.post("/:artifactRequestId/candidates/:candidateId/discard", discardArtifactCandidateController);

export { artifactRequestRouter };

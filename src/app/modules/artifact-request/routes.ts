import type { Router } from "express";
import express from "express";
import { createArtifactRequestController } from "./controller.js";

const artifactRequestRouter: Router = express.Router();

artifactRequestRouter.post("/", createArtifactRequestController);

export { artifactRequestRouter };

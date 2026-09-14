import { artifactOrchestrator } from "./functions/artifactOrchestrator.js";
import { changeSetRetriever } from "./functions/changesetRetriever.js";

export const functions = [changeSetRetriever, artifactOrchestrator];

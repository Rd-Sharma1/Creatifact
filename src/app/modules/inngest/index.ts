import { changeSetRetriever } from "./functions/changesetRetriever.js";
import { artifactGeneration } from "./functions/artifactGeneration.js";
import { artifactGenerationOutbox } from "./functions/artifactGenerationOutbox.js";

export const functions = [changeSetRetriever, artifactGeneration, artifactGenerationOutbox];

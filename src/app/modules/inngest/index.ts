import { changeSetRetriever } from "./functions/changesetRetriever.js";
import { artifactGeneration, artifactGenerationCancelled } from "./functions/artifactGeneration.js";
import { artifactGenerationOutbox } from "./functions/artifactGenerationOutbox.js";

export const functions = [changeSetRetriever, artifactGeneration, artifactGenerationCancelled, artifactGenerationOutbox];

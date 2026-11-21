import { artifactGeneration, artifactGenerationCancelled } from "./functions/artifactGeneration.js";
import { artifactGenerationOutbox } from "./functions/artifactGenerationOutbox.js";
import { changeSetRetriever } from "./functions/changesetRetriever.js";

export const functions = [
    changeSetRetriever,
    artifactGeneration,
    artifactGenerationCancelled,
    artifactGenerationOutbox,
];

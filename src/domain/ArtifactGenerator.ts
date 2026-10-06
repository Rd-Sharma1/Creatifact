import type { ArtifactGenerationContext, ArtifactType, GeneratedArtifactResult } from "./types.js";

export interface ArtifactGenerator {
    readonly artifactType: ArtifactType;
    generate(context: ArtifactGenerationContext): Promise<GeneratedArtifactResult>;
}

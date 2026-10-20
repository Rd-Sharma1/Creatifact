import type { ArtifactGenerationContext, ArtifactType, GeneratedArtifactCandidates } from "./types.js";

export interface ArtifactGenerator {
    readonly artifactType: ArtifactType;
    generate(context: ArtifactGenerationContext): Promise<GeneratedArtifactCandidates>;
}

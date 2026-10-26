import type { ArtifactGenerationContext, ArtifactGenerationTrace, ArtifactType, GeneratedArtifactCandidates } from "./types.js";

export interface ArtifactGenerator {
    readonly artifactType: ArtifactType;
    generate(context: ArtifactGenerationContext, trace?: ArtifactGenerationTrace): Promise<GeneratedArtifactCandidates>;
}

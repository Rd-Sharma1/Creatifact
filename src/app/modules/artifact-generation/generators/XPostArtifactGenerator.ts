import type { ArtifactGenerator } from "../../../../domain/ArtifactGenerator.js";
import type { ArtifactGenerationContext, GeneratedArtifactResult } from "../../../../domain/types.js";

export class XPostArtifactGenerator implements ArtifactGenerator {
    readonly artifactType = "X_POST" as const;

    async generate(_context: ArtifactGenerationContext): Promise<GeneratedArtifactResult> {
        return {
            type: this.artifactType,
            content: "X_POST generation is not implemented yet.",
        };
    }
}

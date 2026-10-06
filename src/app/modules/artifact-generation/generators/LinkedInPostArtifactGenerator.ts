import type { ArtifactGenerator } from "../../../../domain/ArtifactGenerator.js";
import type { ArtifactGenerationContext, GeneratedArtifactResult } from "../../../../domain/types.js";

export class LinkedInPostArtifactGenerator implements ArtifactGenerator {
    readonly artifactType = "LINKEDIN_POST" as const;

    async generate(_context: ArtifactGenerationContext): Promise<GeneratedArtifactResult> {
        return {
            type: this.artifactType,
            content: "LINKEDIN_POST generation is not implemented yet.",
        };
    }
}

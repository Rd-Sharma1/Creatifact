import type { ArtifactGenerator } from "../../../../domain/ArtifactGenerator.js";
import type { ArtifactGenerationContext, GeneratedArtifactCandidates } from "../../../../domain/types.js";
import { OpenRouterCandidateGenerator } from "../OpenRouterCandidateGenerator.js";

export class LinkedInPostArtifactGenerator implements ArtifactGenerator {
    readonly artifactType = "LINKEDIN_POST" as const;
    private readonly generator = new OpenRouterCandidateGenerator(this.artifactType);

    generate(context: ArtifactGenerationContext): Promise<GeneratedArtifactCandidates> {
        return this.generator.generate(context);
    }
}

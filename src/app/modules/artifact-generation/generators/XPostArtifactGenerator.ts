import type { ArtifactGenerator } from "../../../../domain/ArtifactGenerator.js";
import type { ArtifactGenerationContext, ArtifactGenerationTrace, GeneratedArtifactCandidates } from "../../../../domain/types.js";
import { OpenRouterCandidateGenerator } from "../OpenRouterCandidateGenerator.js";

export class XPostArtifactGenerator implements ArtifactGenerator {
    readonly artifactType = "X_POST" as const;
    private readonly generator = new OpenRouterCandidateGenerator(this.artifactType);

    generate(context: ArtifactGenerationContext, trace?: ArtifactGenerationTrace): Promise<GeneratedArtifactCandidates> {
        return this.generator.generate(context, trace);
    }
}

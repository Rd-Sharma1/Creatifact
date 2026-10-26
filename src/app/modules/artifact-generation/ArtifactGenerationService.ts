import type { ArtifactGenerationContext, ArtifactGenerationTrace, ArtifactType, GeneratedArtifactCandidates } from "../../../domain/types.js";
import { artifactGeneratorRegistry, ArtifactGeneratorRegistry } from "./ArtifactGeneratorRegistry.js";
import { artifactGenerationContextService, ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";
import { DomainValidationError } from "../../common/errors.js";

export class ArtifactGenerationService {
    constructor(
        private readonly contextService: Pick<ArtifactGenerationContextService, "build"> = artifactGenerationContextService,
        private readonly generatorRegistry: Pick<ArtifactGeneratorRegistry, "resolve"> = artifactGeneratorRegistry,
    ) {}

    buildContext(artifactRequestId: string): Promise<ArtifactGenerationContext> {
        return this.contextService.build(artifactRequestId);
    }

    async generateType(context: ArtifactGenerationContext, type: ArtifactType, trace?: ArtifactGenerationTrace): Promise<GeneratedArtifactCandidates> {
        const generator = this.generatorRegistry.resolve(type);
        const result = await generator.generate(context, trace);
        if (result.type !== type || result.candidates.length < 1 || result.candidates.length > 2) {
            throw new DomainValidationError("INVALID_GENERATOR_RESULT", "Artifact generator returned an invalid result");
        }
        return result;
    }

    async generate(artifactRequestId: string): Promise<GeneratedArtifactCandidates[]> {
        const context = await this.buildContext(artifactRequestId);
        return Promise.all(context.requestedArtifactTypes.map(type => this.generateType(context, type)));
    }
}

export const artifactGenerationService = new ArtifactGenerationService();

import type { ArtifactGenerator } from "../../../domain/ArtifactGenerator.js";
import type { GeneratedArtifactResult } from "../../../domain/types.js";
import { artifactGeneratorRegistry, ArtifactGeneratorRegistry } from "./ArtifactGeneratorRegistry.js";
import { artifactGenerationContextService, ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";

export class ArtifactGenerationService {
    constructor(
        private readonly contextService: Pick<ArtifactGenerationContextService, "build"> = artifactGenerationContextService,
        private readonly generatorRegistry: Pick<ArtifactGeneratorRegistry, "resolve"> = artifactGeneratorRegistry,
    ) {}

    async generate(artifactRequestId: string): Promise<GeneratedArtifactResult[]> {
        const context = await this.contextService.build(artifactRequestId);
        const generators: ArtifactGenerator[] = context.requestedArtifactTypes.map(type => this.generatorRegistry.resolve(type));
        return Promise.all(generators.map(generator => generator.generate(context)));
    }
}

export const artifactGenerationService = new ArtifactGenerationService();

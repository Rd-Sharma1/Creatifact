import type { ArtifactGenerationContext, ArtifactType, GeneratedArtifactResult } from "../../../domain/types.js";
import { artifactGeneratorRegistry, ArtifactGeneratorRegistry } from "./ArtifactGeneratorRegistry.js";
import { artifactGenerationContextService, ArtifactGenerationContextService } from "./ArtifactGenerationContextService.js";

export class ArtifactGenerationService {
    constructor(
        private readonly contextService: Pick<ArtifactGenerationContextService, "build"> = artifactGenerationContextService,
        private readonly generatorRegistry: Pick<ArtifactGeneratorRegistry, "resolve"> = artifactGeneratorRegistry,
    ) {}

    buildContext(artifactRequestId: string): Promise<ArtifactGenerationContext> {
        return this.contextService.build(artifactRequestId);
    }

    async generateType(context: ArtifactGenerationContext, type: ArtifactType): Promise<GeneratedArtifactResult> {
        const generator = this.generatorRegistry.resolve(type);
        const result = await generator.generate(context);
        if (result.type !== type) {
            throw new Error(`ArtifactGenerator for ${type} returned ${result.type}`);
        }
        return result;
    }

    async generate(artifactRequestId: string): Promise<GeneratedArtifactResult[]> {
        const context = await this.buildContext(artifactRequestId);
        return Promise.all(context.requestedArtifactTypes.map(type => this.generateType(context, type)));
    }
}

export const artifactGenerationService = new ArtifactGenerationService();

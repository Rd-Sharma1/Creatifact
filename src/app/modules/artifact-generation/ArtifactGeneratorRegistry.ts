import type { ArtifactGenerator } from "../../../domain/ArtifactGenerator.js";
import { DomainValidationError } from "../../common/errors.js";
import { LinkedInPostArtifactGenerator } from "./generators/LinkedInPostArtifactGenerator.js";
import { XPostArtifactGenerator } from "./generators/XPostArtifactGenerator.js";

export class UnsupportedArtifactTypeError extends DomainValidationError {
    constructor(type: string) {
        super("UNSUPPORTED_ARTIFACT_TYPE", `No ArtifactGenerator registered for type: ${type}`);
    }
}

export class ArtifactGeneratorRegistry {
    private readonly generatorsByType: ReadonlyMap<string, ArtifactGenerator>;

    constructor(generators: readonly ArtifactGenerator[]) {
        const entries = new Map<string, ArtifactGenerator>();
        for (const generator of generators) {
            if (entries.has(generator.artifactType)) {
                throw new Error(`Duplicate ArtifactGenerator registered for type: ${generator.artifactType}`);
            }
            entries.set(generator.artifactType, generator);
        }
        this.generatorsByType = entries;
    }

    resolve(type: string): ArtifactGenerator {
        const generator = this.generatorsByType.get(type);
        if (!generator) {
            throw new UnsupportedArtifactTypeError(type);
        }
        return generator;
    }
}

export const artifactGeneratorRegistry = new ArtifactGeneratorRegistry([
    new XPostArtifactGenerator(),
    new LinkedInPostArtifactGenerator(),
]);

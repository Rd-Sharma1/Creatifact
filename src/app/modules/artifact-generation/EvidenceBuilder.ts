import type { ArtifactEvidenceItem, ArtifactGenerationChangeSet } from "../../../domain/types.js";
import { sanitizeModelText } from "../llm/ModelInputSanitizer.js";

export const MAX_EVIDENCE_CHARACTERS = 24_000;
export const MAX_PATCH_EXCERPT_CHARACTERS = 1_800;

function safeEvidenceField(value: string): string {
    const sanitized = sanitizeModelText(value);
    return sanitized.unsafe ? "" : sanitized.text;
}

function patchExcerpt(patch: string | null): string {
    if (!patch) return "";
    const sanitized = sanitizeModelText(patch);
    if (sanitized.unsafe) return "[Patch omitted because sensitive key material could not be safely delimited]";

    const focused = sanitized.text
        .split("\n")
        .filter(line => !/^(?:diff --git |index [0-9a-f]+\.\.[0-9a-f]+|--- |\+\+\+ |\\ No newline)/.test(line))
        .join("\n");
    if (focused.length <= MAX_PATCH_EXCERPT_CHARACTERS) return focused;
    const marker = "\n[Patch excerpt truncated]";
    return `${focused.slice(0, MAX_PATCH_EXCERPT_CHARACTERS - marker.length)}${marker}`;
}

export class EvidenceBuilder {
    build(changeSets: ArtifactGenerationChangeSet[]): ArtifactEvidenceItem[] {
        let remaining = MAX_EVIDENCE_CHARACTERS;
        const evidence: ArtifactEvidenceItem[] = [];
        const ordered = [...changeSets].sort((left, right) => {
            if (left.role !== right.role) return left.role === "TARGET" ? -1 : 1;
            return left.changeSet.createdAt.getTime() - right.changeSet.createdAt.getTime() || left.changeSet.id.localeCompare(right.changeSet.id);
        });

        for (const item of ordered) {
            const parts = [
                ...item.changeSet.commits.map(commit => {
                    const message = safeEvidenceField(commit.message);
                    return message ? `Commit: ${message}` : "";
                }),
                ...item.changeSet.changes.map(change => {
                    const filename = safeEvidenceField(change.filename);
                    if (!filename) return "";
                    return [
                        `File: ${filename}`,
                        `Status: ${change.status}`,
                        `Additions: ${change.additions}; deletions: ${change.deletions}`,
                        patchExcerpt(change.patch),
                    ].filter(Boolean).join("\n");
                }),
            ].filter(Boolean);
            let text = parts.join("\n\n");
            if (!text || remaining <= 0) continue;
            text = text.slice(0, remaining);
            evidence.push({ changeSetId: item.changeSet.id, role: item.role, text });
            remaining -= text.length;
        }
        return evidence;
    }
}

export const evidenceBuilder = new EvidenceBuilder();

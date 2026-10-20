import type { ArtifactEvidenceItem, ArtifactGenerationChangeSet } from "../../../domain/types.js";

export const MAX_EVIDENCE_CHARACTERS = 24_000;

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
                ...item.changeSet.commits.map(commit => `Commit: ${commit.message}`),
                ...item.changeSet.changes.map(change => [
                    `File: ${change.filename}`,
                    `Status: ${change.status}`,
                    `Additions: ${change.additions}; deletions: ${change.deletions}`,
                    change.patch ?? "",
                ].join("\n")),
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

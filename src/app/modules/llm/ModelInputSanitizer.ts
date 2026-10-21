import type { ActivityMapEntry, ArtifactEvidenceItem } from "../../../domain/types.js";

const REDACTED = "[REDACTED]";

export type SanitizedModelText = {
    text: string;
    redactionCount: number;
    unsafe: boolean;
};

/** Best-effort removal of recognizable secrets and common personal identifiers before model calls. */
export function sanitizeModelText(input: string): SanitizedModelText {
    let text = input;
    let redactionCount = 0;
    let unsafe = false;

    text = text.replace(/-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/gi, match => {
        redactionCount++;
        if (!/-----END [A-Z0-9 ]*PRIVATE KEY-----/i.test(match)) unsafe = true;
        return `${REDACTED} PRIVATE KEY MATERIAL`;
    });

    text = text.replace(/\b((?:[A-Z0-9_]*[_-])?(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret|private[_-]?key)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, (match, key: string) => {
        const value = match.slice(key.length).trim();
        // Keep common source-code references intact; redact literal values and opaque tokens.
        if (/^(?:(?:process\.env|import\.meta\.env|env|config|settings|secrets)\.)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value) ||
            /^[A-Za-z_$][\w$]*\([^)]*\)$/.test(value)) return match;
        redactionCount++;
        return `${key}${REDACTED}`;
    });

    const patterns: Array<[RegExp, string]> = [
        [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED}`],
        [/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, REDACTED],
        [/\bAKIA[0-9A-Z]{16}\b/g, REDACTED],
        [/\bAIza[0-9A-Za-z_-]{30,}\b/g, REDACTED],
        [/\b(?:sk|rk)(?:-|_live_)[A-Za-z0-9_-]{20,}\b/g, REDACTED],
        [/\b(?:glpat-|npm_)[A-Za-z0-9_-]{20,}\b/g, REDACTED],
        [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, REDACTED],
        [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED],
        [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED],
    ];

    for (const [pattern, replacement] of patterns) {
        text = text.replace(pattern, () => {
            redactionCount++;
            return replacement;
        });
    }

    return { text, redactionCount, unsafe };
}

/** Re-sanitize at each provider boundary so direct callers cannot bypass the source-data filter. */
export function sanitizeEvidenceForModel(evidence: ArtifactEvidenceItem[]): ArtifactEvidenceItem[] {
    return evidence.flatMap(item => {
        const sanitized = sanitizeModelText(item.text);
        if (sanitized.unsafe || !sanitized.text.trim()) return [];
        return [{ ...item, text: sanitized.text }];
    });
}

export function sanitizeActivityForModel(activity: ActivityMapEntry[]): Array<{
    createdAt: Date;
    files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
    commitMessages: string[];
    additions: number;
    deletions: number;
}> {
    return activity.map(entry => ({
        createdAt: entry.createdAt,
        files: entry.files.flatMap(file => {
            const safe = sanitizeModelText(file.filename);
            return safe.unsafe ? [] : [{ ...file, filename: safe.text }];
        }),
        commitMessages: entry.commitMessages.flatMap(message => {
            const safe = sanitizeModelText(message);
            return safe.unsafe ? [] : [safe.text];
        }),
        additions: entry.additions,
        deletions: entry.deletions,
    }));
}

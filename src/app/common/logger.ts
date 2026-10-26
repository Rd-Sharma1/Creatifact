export type LogSeverity = "debug" | "info" | "warn" | "error";

export type StructuredLogFields = Record<string, string | number | boolean | null | undefined>;

export function writeLog(severity: LogSeverity, event: string, fields: StructuredLogFields = {}): void {
    try {
        const entry = {
            timestamp: new Date().toISOString(),
            severity,
            event,
            ...fields,
        };
        const output = JSON.stringify(entry);
        if (severity === "error") console.error(output);
        else if (severity === "warn") console.warn(output);
        else if (severity === "debug") console.debug(output);
        else console.info(output);
    } catch {
        // Logging is deliberately best-effort and must not alter application behavior.
    }
}

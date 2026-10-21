import { z } from "zod";
import { RequestValidationError } from "./errors.js";

export function safeZodDetails(error: z.ZodError): { issues: Array<{ path: string; code: string }> } {
    return {
        issues: error.issues.map(issue => ({
            path: issue.path.map(String).join("."),
            code: issue.code,
        })),
    };
}

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) throw new RequestValidationError(safeZodDetails(result.error));
    return result.data;
}


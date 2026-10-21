import { z } from "zod";
import { ConfigurationError } from "../app/common/errors.js";

const optionalString = <T extends z.ZodType>(schema: T) => z.preprocess(
    value => value === "" ? undefined : value,
    schema.optional(),
);
const postgresUrlSchema = z.url().refine(value => ["postgres:", "postgresql:"].includes(new URL(value).protocol));

export const environmentSchema = z.object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
    DATABASE_URL: optionalString(postgresUrlSchema),
    TEST_DATABASE_URL: optionalString(postgresUrlSchema),
    PREFLIGHT_DATABASE_URL: optionalString(postgresUrlSchema),
    INNGEST_EVENT_KEY: optionalString(z.string().min(1)),
    INNGEST_SIGNING_KEY: optionalString(z.string().min(1)),
    GITHUB_APP_ID: optionalString(z.string().regex(/^\d+$/).refine(value => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER))),
    GITHUB_APP_SLUG: optionalString(z.string().min(1)),
    GITHUB_APP_CLIENT_ID: optionalString(z.string().min(1)),
    GITHUB_APP_CLIENT_SECRET: optionalString(z.string().min(1)),
    GITHUB_APP_CALLBACK_URL: optionalString(z.url()),
    GITHUB_PRIVATE_KEY: optionalString(z.string().min(1)),
    GITHUB_WEBHOOK_SECRET: optionalString(z.string().min(1)),
    APP_ORIGIN: optionalString(z.url()),
    AUTH_COOKIE_SECURE: optionalString(z.enum(["true", "false"])),
    OPENROUTER_API_KEY: optionalString(z.string().min(1)),
    OPENROUTER_GENERATION_MODEL: optionalString(z.string().min(1)),
    OPENROUTER_SCOPE_MODEL: optionalString(z.string().min(1)),
});

export type Environment = z.infer<typeof environmentSchema>;

export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
    const parsed = environmentSchema.safeParse(input);
    if (!parsed.success) {
        throw new ConfigurationError({
            issues: parsed.error.issues.map(issue => ({ path: issue.path.map(String).join("."), code: issue.code })),
        });
    }
    return parsed.data;
}

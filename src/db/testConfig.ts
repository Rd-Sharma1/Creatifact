export function validateTestDatabaseUrl(testUrl: string | undefined, appUrl: string | undefined): string | undefined {
    if (!testUrl) return "TEST_DATABASE_URL is required for database-backed tests.";
    if (!appUrl) return "DATABASE_URL is required to confirm the test database is separate.";

    let test: URL;
    try {
        test = new URL(testUrl);
    } catch {
        return "TEST_DATABASE_URL must be a valid PostgreSQL connection URL.";
    }
    if (test.protocol !== "postgres:" && test.protocol !== "postgresql:") {
        return "TEST_DATABASE_URL must use the postgres or postgresql protocol.";
    }
    let databaseName: string;
    try {
        databaseName = decodeURIComponent(test.pathname.slice(1));
    } catch {
        return "TEST_DATABASE_URL must contain a valid database name.";
    }
    if (!databaseName.endsWith("_test")) {
        return "TEST_DATABASE_URL must target a database whose name ends in _test.";
    }
    if (!test.hostname) return "TEST_DATABASE_URL must include a PostgreSQL host.";

    try {
        const app = new URL(appUrl);
        if ((app.protocol !== "postgres:" && app.protocol !== "postgresql:") || !app.hostname) {
            return "DATABASE_URL must be a valid PostgreSQL URL to verify test-database separation.";
        }
        const appDatabaseName = decodeURIComponent(app.pathname.slice(1));
        const testPort = test.port || "5432";
        const appPort = app.port || "5432";
        if (test.hostname.toLowerCase() === app.hostname.toLowerCase() && testPort === appPort && databaseName === appDatabaseName) {
            return "TEST_DATABASE_URL must not target the same database as DATABASE_URL.";
        }
    } catch {
        return "DATABASE_URL must be a valid PostgreSQL URL to verify test-database separation.";
    }
    return undefined;
}

export function requireTestDatabaseUrl(
    testUrl = process.env.TEST_DATABASE_URL,
    appUrl = process.env.DATABASE_URL,
): string {
    const error = validateTestDatabaseUrl(testUrl, appUrl);
    if (error) throw new Error(error);
    return testUrl!;
}

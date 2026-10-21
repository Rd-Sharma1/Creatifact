import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requireTestDatabaseUrl } from "./testConfig.js";

export function createTestDatabase() {
    const pool = new Pool({
        connectionString: requireTestDatabaseUrl(),
        max: 4,
        application_name: "creatifact-v1-integration-tests",
    });
    return {
        db: drizzle(pool),
        close: () => pool.end(),
    };
}

import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { createTestDatabase } from "../src/db/testDatabase.js";

const testDatabase = createTestDatabase();
try {
    await migrate(testDatabase.db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    console.log("Applied pending Drizzle migrations to the explicitly configured test database.");
} catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`Test database migration failed (${name}); connection details were not printed.`);
    process.exitCode = 1;
} finally {
    await testDatabase.close();
}

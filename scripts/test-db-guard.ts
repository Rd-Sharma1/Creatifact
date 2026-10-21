import "dotenv/config";
import { validateTestDatabaseUrl } from "./db-preflight.js";

const error = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
if (error) {
    console.error(error);
    process.exitCode = 1;
} else {
    console.log("TEST_DATABASE_URL is set to a distinct database ending in _test. No connection was opened.");
}

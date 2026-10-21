import { createServer } from "node:http";
import { createApplications } from "./app/index.js";
import { readEnvironment } from "./config/environment.js";
import { ApplicationError } from "./app/common/errors.js";

try {
    const { PORT } = readEnvironment();
    const server = createServer(createApplications());

    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} catch (error) {
    console.error(JSON.stringify({
        event: "http.server.start_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
        ...(error instanceof ApplicationError ? { errorCode: error.code, details: error.details } : {}),
    }));
    process.exitCode = 1;
}

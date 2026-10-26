import { createServer } from "node:http";
import { createApplications } from "./app/index.js";
import { readEnvironment } from "./config/environment.js";
import { ApplicationError } from "./app/common/errors.js";
import { writeLog } from "./app/common/logger.js";

try {
    const { PORT } = readEnvironment();
    const server = createServer(createApplications());

    server.listen(PORT, () => {
        writeLog("info", "http.server.started", { port: PORT });
    });
} catch (error) {
    writeLog("error", "http.server.start_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        ...(error instanceof ApplicationError ? { errorCode: error.code } : {}),
    });
    process.exitCode = 1;
}

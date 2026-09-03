import { createServer } from "node:http";
import { createApplications } from "./app/index.js";

try {
    const server = createServer(createApplications());

    const PORT: number = parseInt(process.env.PORT || "8080");

    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} catch (error) {
    console.error("Error starting http server:", error);
}

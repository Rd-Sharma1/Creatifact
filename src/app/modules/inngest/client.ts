import "dotenv/config";
import { Inngest } from "inngest";

const inngest = new Inngest({
    id: "creatifact-artifact-app",
});

export { inngest };

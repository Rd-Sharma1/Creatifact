//Consider putting this one inside the modules/github/service.ts
//Chnage type of payload zod!!!
import { inngest } from "../inngest/client.js";

const pushEventService = async (payload: any) => {
    const { ref, repository, before, after, commits, compare } = payload;

    //emit inngest event fetch-detail
    console.log("Emitting event to inngest");
    inngest.send({
        name: "github/push.received",
        data: {
            ref,
            repository,
            before,
            after,
            commits,
            compare,
        },
    });
};

export { pushEventService };

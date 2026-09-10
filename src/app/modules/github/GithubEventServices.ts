//Consider putting this one inside the modules/github/service.ts
//Chnage type of payload zod!!!
import { inngest } from "../inngest/client.js";

const pushEventService = async (payload: any) => {
    const { ref, repository, before, after, basehead, commits, compare } = payload;
    //emit inngest event fetch-detail
    console.log("Emitting event to inngest");
    // console.log({ ref, repository, before, after, commits, compare });
    // return; //temporary return to avoid sending event to inngest during testing
    /* 
     proposed data shape to be sent to inngest:
    {
        ref: string,
        repository: {
            id: number,
            full_name: string,
            private: boolean,
            owner: {
                login: string,
                url: string,
                html_url: string,
                }
            html_url: string,
            url: string,
            commits_url: string,
            created_at: string,
            updates_at: string,
            visibility: string,
        },
        before: string,
        after: string,
        commits: [
            {
                id: string,
                message: string,
                timestamp: string,
                url: string
            },...
        ],
        compare: string
}   
    */
    await inngest.send({
        name: "github/push.received",
        data: {
            installationId: payload.installation.id,
            ref,
            repositoryId: repository.id,
            repositoryName: repository.name,
            owner: repository.owner.login,
            before,
            after,
            compareUrl: compare,
        },
    });
};

export { pushEventService };

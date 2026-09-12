import { fetchChangeSet } from "./fetch.js";
import { persistChangeSet } from "./persist.js";

class ChangeSetService {
    static async persist(changeSet: any) {
        return persistChangeSet(changeSet);
    }
    static async fetch(changeSetId: string) {
        return fetchChangeSet(changeSetId);
    }
}

export default ChangeSetService;

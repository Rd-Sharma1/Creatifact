import { fetchChangeSet } from "./fetch.js";
import { persistChangeSet } from "./persist.js";
import type { NewChangeSet } from "../../../domain/types.js";

class ChangeSetService {
    static async persist(changeSet: NewChangeSet) {
        return persistChangeSet(changeSet);
    }
    static async fetch(changeSetId: string) {
        return fetchChangeSet(changeSetId);
    }
}

export default ChangeSetService;

import { createChangeSet } from "./persist.js";

class ChangeSetService {
    static async create(changeSet: any) {
        return createChangeSet(changeSet);
    }
}

export default ChangeSetService;

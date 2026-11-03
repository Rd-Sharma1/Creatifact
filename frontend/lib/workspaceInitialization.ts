import { getCurrentUser, getRepositories, type AuthorizedRepository, type CurrentUser } from "./api";

export type InitializedWorkspace = {
    user: CurrentUser;
    repositories: AuthorizedRepository[];
};

type WorkspaceLoaders = {
    loadCurrentUser: () => Promise<CurrentUser>;
    loadRepositories: () => Promise<{ repositories: AuthorizedRepository[] }>;
};

const apiLoaders: WorkspaceLoaders = { loadCurrentUser: getCurrentUser, loadRepositories: getRepositories };

export async function initializeWorkspace(loaders: WorkspaceLoaders = apiLoaders): Promise<InitializedWorkspace> {
    // Authenticate before requesting protected repository data. This makes the
    // session gate explicit and ensures a failed session check cannot obscure
    // whether the repository request was reached.
    const user = await loaders.loadCurrentUser();
    const { repositories } = await loaders.loadRepositories();
    return { user, repositories };
}

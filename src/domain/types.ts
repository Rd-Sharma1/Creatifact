export const ARTIFACT_REQUEST_STATUSES = ["PENDING", "GENERATING", "COMPLETED", "FAILED"] as const;
export type ArtifactRequestStatus = (typeof ARTIFACT_REQUEST_STATUSES)[number];

export const ARTIFACT_TYPES = ["X_POST", "LINKEDIN_POST"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export type ArtifactRequestScope =
    | { type: "TODAY" }
    | { type: "YESTERDAY" }
    | { type: "THIS_WEEK" }
    | { type: "LAST_WEEK" }
    | { type: "LATEST" }
    | { type: "DATE_RANGE"; from: string; to: string };

export type Repository = {
    id: string;
    githubRepoId: bigint;
    owner: string;
    name: string;
    createdAt: Date;
};

export type ChangeSetCommit = {
    sha: string;
    message: string;
    author: {
        name: string | null;
        username: string | null;
    };
    timestamp: string | null;
    url: string;
};

export type ChangeSetChange = {
    filename: string;
    previousFilename: string | null;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch: string | null;
};

export type ChangeSet = {
    id: string;
    repositoryId: string;
    base: string;
    head: string;
    basehead: string;
    commits: ChangeSetCommit[];
    changes: ChangeSetChange[];
    createdAt: Date;
};

export type NewChangeSet = Omit<ChangeSet, "id" | "createdAt">;

export type RetrievedChangeSet = Pick<ChangeSet, "base" | "head" | "basehead" | "commits" | "changes">;

export type ArtifactRequest = {
    id: string;
    repositoryId: string;
    instructions: string | null;
    status: ArtifactRequestStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type Artifact = {
    id: string;
    artifactRequestId: string;
    type: ArtifactType;
    content: string;
    createdAt: Date;
};

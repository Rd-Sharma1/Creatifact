export const ARTIFACT_REQUEST_STATUSES = ["PENDING", "GENERATING", "COMPLETED", "FAILED"] as const;
export type ArtifactRequestStatus = (typeof ARTIFACT_REQUEST_STATUSES)[number];

export const ARTIFACT_TYPES = ["X_POST", "LINKEDIN_POST"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_CANDIDATE_STATUSES = ["READY", "SELECTED", "DISCARDED"] as const;
export type ArtifactCandidateStatus = (typeof ARTIFACT_CANDIDATE_STATUSES)[number];

export const CHANGE_SET_ROLES = ["TARGET", "SUPPORTING"] as const;
export type ChangeSetRole = (typeof CHANGE_SET_ROLES)[number];

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
    scope: ArtifactRequestScope | null;
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

export type CandidateEvidenceReference = {
    changeSetId: string;
    quote: string;
};

export type ArtifactCandidateEvidence = CandidateEvidenceReference & { claim: string };

export type ArtifactCandidate = {
    id: string;
    artifactRequestId: string;
    type: ArtifactType;
    ordinal: number;
    angle: string;
    content: string;
    evidence: ArtifactCandidateEvidence[];
    status: ArtifactCandidateStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type GenerationCandidateInput = {
    content: string;
    angle: string;
    claims: Array<{
        claim: string;
        evidence: CandidateEvidenceReference[];
    }>;
};

export type GeneratedArtifactCandidates = {
    type: ArtifactType;
    candidates: GenerationCandidateInput[];
};

export type ArtifactGenerationChangeSet = {
    role: ChangeSetRole;
    changeSet: ChangeSet;
};

export type ArtifactEvidenceItem = {
    changeSetId: string;
    role: ChangeSetRole;
    text: string;
};

export type ArtifactGenerationContext = {
    artifactRequest: Pick<ArtifactRequest, "id" | "instructions" | "scope">;
    repository: Pick<Repository, "id" | "owner" | "name">;
    requestedArtifactTypes: ArtifactType[];
    changeSets: ArtifactGenerationChangeSet[];
    evidence: ArtifactEvidenceItem[];
};

export type ActivityMapFile = {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
};

export type ActivityMapEntry = {
    id: string;
    createdAt: Date;
    repository: { id: string; owner: string; name: string };
    files: ActivityMapFile[];
    commitMessages: string[];
    additions: number;
    deletions: number;
};

export type ResolvedArtifactIntent = {
    scope: ArtifactRequestScope;
    focusTerms: string[];
    clarification: string | null;
};

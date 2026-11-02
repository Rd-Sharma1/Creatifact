export type ApiErrorEnvelope = {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    requestId: string | null;
};

export type CurrentUser = { id: string; githubName: string };
export type AuthorizedRepository = {
    id: string;
    githubRepoId: string;
    owner: string;
    name: string;
};
export type RepositoryList = { repositories: AuthorizedRepository[] };
export type ArtifactType = "X_POST" | "LINKEDIN_POST";
export type ArtifactRequestStatus = "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
export type CandidateStatus = "READY" | "SELECTED" | "DISCARDED";
export type ChangeSetRole = "TARGET" | "SUPPORTING";
export type ArtifactRequestScope =
    | { type: "TODAY" }
    | { type: "YESTERDAY" }
    | { type: "THIS_WEEK" }
    | { type: "LAST_WEEK" }
    | { type: "LATEST" }
    | { type: "DATE_RANGE"; from: string; to: string };
export type CreateArtifactRequestInput = {
    repositoryId: string;
    artifactTypes: ArtifactType[];
    scope?: ArtifactRequestScope;
    instructions?: string | null;
};
export type ArtifactCandidate = {
    id: string;
    artifactRequestId: string;
    type: ArtifactType;
    ordinal: number;
    angle: string;
    content: string;
    evidence: Array<{ claim: string; changeSetId: string; quote: string }>;
    status: CandidateStatus;
    createdAt: string;
    updatedAt: string;
};
export type Artifact = {
    id: string;
    artifactRequestId: string;
    type: ArtifactType;
    content: string;
    createdAt: string;
};
export type ArtifactRequestDetail = {
    id: string;
    repositoryId: string;
    instructions: string | null;
    scope: ArtifactRequestScope | null;
    status: ArtifactRequestStatus;
    createdAt: string;
    updatedAt: string;
    artifactTypes: ArtifactType[];
    changeSets: Array<{ id: string; role: ChangeSetRole }>;
    candidates: ArtifactCandidate[];
    artifacts: Artifact[];
};
export type ArtifactRequestCreated = {
    id: string;
    repositoryId: string;
    artifactTypes: ArtifactType[];
    scope: ArtifactRequestScope;
    instructions: string | null;
    targetChangeSetIds: string[];
    supportingChangeSetIds: string[];
    status: ArtifactRequestStatus;
    createdAt: string;
};

export class ApiClientError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code: string,
        readonly requestId: string | null,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

export class AuthenticationRequiredError extends ApiClientError {
    constructor() {
        super("Authentication required", 401, "AUTHENTICATION_REQUIRED", null);
        this.name = "AuthenticationRequiredError";
    }
}

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const apiBaseUrl = (configuredApiBaseUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")).replace(/\/+$/, "");

export function apiUrl(path: string): string {
    if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production.");
    return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
    if (typeof value !== "object" || value === null || !("error" in value)) return false;
    const error = value.error;
    return typeof error === "object" && error !== null &&
        "code" in error && typeof error.code === "string" &&
        "message" in error && typeof error.message === "string" &&
        "requestId" in value && (typeof value.requestId === "string" || value.requestId === null);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
        response = await fetch(apiUrl(path), { ...init, headers, credentials: "include" });
    } catch {
        throw new ApiClientError("The API could not be reached. Check your connection and try again.", 0, "NETWORK_ERROR", null);
    }

    if (response.status === 204) return undefined as T;

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new ApiClientError("The API returned an unexpected response.", response.status, "UNEXPECTED_RESPONSE", null);
    }

    if (!response.ok) {
        if (response.status === 401) throw new AuthenticationRequiredError();
        if (isApiErrorEnvelope(body)) {
            throw new ApiClientError(body.error.message, response.status, body.error.code, body.requestId);
        }
        throw new ApiClientError("The API could not complete the request.", response.status, "UNEXPECTED_ERROR", null);
    }

    return body as T;
}

export function getCurrentUser(): Promise<CurrentUser> {
    return apiRequest<CurrentUser>("/api/auth/me");
}

export function getRepositories(): Promise<RepositoryList> {
    return apiRequest<RepositoryList>("/api/repositories");
}

export function logout(): Promise<void> {
    return apiRequest<void>("/api/auth/logout", { method: "POST" });
}

export function createArtifactRequest(input: CreateArtifactRequestInput): Promise<ArtifactRequestCreated> {
    return apiRequest<ArtifactRequestCreated>("/api/artifact-requests", { method: "POST", body: JSON.stringify(input) });
}

export function getArtifactRequest(artifactRequestId: string): Promise<ArtifactRequestDetail> {
    return apiRequest<ArtifactRequestDetail>(`/api/artifact-requests/${encodeURIComponent(artifactRequestId)}`);
}

export function editCandidate(artifactRequestId: string, candidateId: string, content: string): Promise<{ candidateId: string; status: "updated" }> {
    return apiRequest(`/api/artifact-requests/${encodeURIComponent(artifactRequestId)}/candidates/${encodeURIComponent(candidateId)}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
    });
}

export function discardCandidate(artifactRequestId: string, candidateId: string): Promise<{ candidateId: string; status: "updated" }> {
    return apiRequest(`/api/artifact-requests/${encodeURIComponent(artifactRequestId)}/candidates/${encodeURIComponent(candidateId)}/discard`, { method: "POST" });
}

export function selectCandidate(artifactRequestId: string, candidateId: string): Promise<{ artifact: Artifact; candidateStatus: "SELECTED" }> {
    return apiRequest(`/api/artifact-requests/${encodeURIComponent(artifactRequestId)}/candidates/${encodeURIComponent(candidateId)}/select`, { method: "POST" });
}

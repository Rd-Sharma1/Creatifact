# Creatifact

Creatifact turns repository ChangeSets into evidence-grounded post candidates. Users review, edit, select, or discard candidates; selecting one creates a final Artifact.

## Local configuration

Copy `.env.example` to `.env` and set `DATABASE_URL`, `OPENROUTER_API_KEY`, and the model identifiers. Keep `.env` private. LLM calls are sent through OpenRouter with provider data collection and retention denied; requests fail closed when no eligible provider is available.

Apply schema changes with `npm run db:migrate` after reviewing the generated SQL migration.

## API

- `POST /api/artifact-requests` creates a request and queues candidate generation. `scope` may be omitted for server-side interpretation.
- `GET /api/artifact-requests/:artifactRequestId` returns request status, resolved context, candidates, and final Artifacts.
- `PATCH /api/artifact-requests/:artifactRequestId/candidates/:candidateId` edits a candidate.
- `POST /api/artifact-requests/:artifactRequestId/candidates/:candidateId/select` selects a candidate and creates its final Artifact.
- `POST /api/artifact-requests/:artifactRequestId/candidates/:candidateId/discard` discards a candidate.

These API routes do not authenticate callers. Run Creatifact only behind a trusted private network boundary until user authentication and ownership checks are implemented.

Health endpoints are `/health/live` and `/health/ready`.

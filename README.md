# Creatifact

Creatifact turns repository ChangeSets into evidence-grounded post candidates. Users review, edit, select, or discard candidates; selecting one creates a final Artifact.

## Local configuration

Copy `.env.example` to `.env` and configure the database, GitHub App, OpenRouter, and Inngest values needed by your deployment. Keep `.env` private. Set `APP_ORIGIN` to the same site that serves the API and frontend. Set `AUTH_COOKIE_SECURE=true` for HTTPS deployments; the example disables it only for local HTTP development.

Apply schema changes with `npm run db:migrate` after reviewing the generated SQL migration.

## API

- `POST /api/artifact-requests` creates a request and queues candidate generation. `scope` may be omitted for server-side interpretation.
- `GET /api/artifact-requests/:artifactRequestId` returns request status, resolved context, candidates, and final Artifacts.
- `PATCH /api/artifact-requests/:artifactRequestId/candidates/:candidateId` edits a candidate.
- `POST /api/artifact-requests/:artifactRequestId/candidates/:candidateId/select` selects a candidate and creates its final Artifact.
- `POST /api/artifact-requests/:artifactRequestId/candidates/:candidateId/discard` discards a candidate.
- `GET /api/auth/github` starts GitHub App user authorization.
- `GET /api/auth/github/callback` completes login or the OAuth-after-install callback.
- `POST /api/auth/github/install` starts GitHub App installation for the signed-in user.
- `GET /api/auth/me` returns the current Creatifact user; `POST /api/auth/logout` revokes the session.
- `GET /api/repositories` lists repositories authorized for the signed-in user.

Authentication uses an HttpOnly session cookie backed by hashed, expiring database tokens. ArtifactRequest and candidate routes require that session and check the user's `user_repo` grant for the parent repository. Unsafe browser requests must send an `Origin` matching `APP_ORIGIN`.

Configure the existing GitHub App with `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_CALLBACK_URL`, and `GITHUB_APP_SLUG`. Enable OAuth after installation and subscribe to `installation`, `installation_repositories`, and `push` events. The callback verifies installation access using the temporary GitHub user token and does not persist that token. Webhook HMAC verification remains separate from user authentication.

The repository currently has no frontend. Until the GitHub App configuration, migrations, auth flows, and protected API behavior have been integration-tested in the deployment environment, keep the service private.

Health endpoints are `/health/live` and `/health/ready`.

# Creatifact

Creatifact turns repository ChangeSets into evidence-grounded post candidates. Users review, edit, select, or discard candidates; selecting one creates a final Artifact.

Before repository activity or instructions are sent to OpenRouter, Creatifact applies best-effort pattern-based redaction to recognizable credentials, private-key blocks, and email addresses. Model evidence omits GitHub repository identity, excludes diff headers, and limits each patch excerpt. These checks reduce accidental disclosure but cannot identify every secret or personal detail; repository content should still be treated as potentially sensitive when enabling an external model provider. Synthetic fixtures cover the known patterns, not every possible credential format.

## Local configuration

Copy `.env.example` to `.env` and configure the database, GitHub App, OpenRouter, and Inngest values needed by your deployment. Keep `.env` private. Set `APP_ORIGIN` to the same site that serves the API and frontend. Set `AUTH_COOKIE_SECURE=true` for HTTPS deployments; the example disables it only for local HTTP development.

### Database preflight and tests

The unit suite uses fakes and does not connect to PostgreSQL. `npm run build`, `npm test`, `git diff --check`, and `npm run db:test:check` can run without a database; the database guard only checks that an explicitly configured `TEST_DATABASE_URL` ends in `_test` and differs from `DATABASE_URL`. Database integration tests use that dedicated connection and never fall back to `DATABASE_URL`.

`npm run db:preflight` is read-only, but it does connect to the explicitly configured `PREFLIGHT_DATABASE_URL` to inspect the migration journal and schema. It is not a database-free check. `npm run db:test:migrate`, `npm run test:integration`, and `npm run db:migrate` also require a database connection; the first two must target the isolated `_test` database, while the last must only be used under the reviewed application migration procedure below. If the isolated integration database has not been provisioned, treat integration tests and test migrations as blocked; do not point them at `DATABASE_URL`.

To prepare a repeatable isolated PostgreSQL test database:

1. Using the test PostgreSQL server and a database administrator account, create a dedicated role and database (these commands create new objects and do not delete existing ones):

   ```sh
   createuser --host <test-postgres-host> --username <provisioner> --pwprompt --no-superuser --no-createdb --no-createrole creatifact_test_user
   createdb --host <test-postgres-host> --username <provisioner> --owner=creatifact_test_user creatifact_test
   ```

   Use another database name only if it ends in `_test`. Do not point this procedure at the application or production database.
2. Configure `TEST_DATABASE_URL` with the test role and test database. Keep `DATABASE_URL` pointed at the normal application target; do not copy it into `TEST_DATABASE_URL`.
3. Run `npm run db:test:check`; this performs URL/name checks only.
4. Run `npm run db:test:migrate` to apply pending checked-in Drizzle migrations to the guarded test database. This command does not reset the schema or delete rows.
5. Run `npm run test:integration`. The tests use synthetic records with unique IDs and remove only rows they created.

The integration suite currently covers session persistence/expiry, repository grant isolation, ChangeSet duplicate persistence, candidate selection idempotency, and outbox persistence. If `TEST_DATABASE_URL` is unset, the guard fails before opening a connection.

Before considering a migration for an existing database:

1. Take and verify an appropriate backup, and confirm the target database and recovery procedure with the database owner.
2. Set `PREFLIGHT_DATABASE_URL` explicitly to the database being assessed. The preflight command never falls back to `DATABASE_URL` and does not print connection details.
3. Run `npm run db:preflight`. It opens a read-only transaction, maps the database migration records to checked-in migration hashes/tags, compares columns, named constraints/indexes, and enum values with the snapshot for the last applied migration, and lists pending migrations. A missing migration baseline, hash mismatch, or missing/incompatible schema object blocks preflight; extra objects are reported for review.
4. Review every pending SQL migration and its existing-data impact manually. The preflight checks schema object presence and basic column properties, not every constraint definition or data-dependent condition. It flags some risky SQL patterns, but cannot prove that constraints, data volume, locks, permissions, or production traffic are safe.
5. Apply migrations only through a separately reviewed and approved release procedure. `npm run db:preflight` never applies migrations or changes data.

Do not assume an existing database is disposable. In particular, a migration adding required columns may be incompatible with existing rows even if the schema comparison passes.

Apply schema changes with `npm run db:migrate` only after preflight, SQL review, backup/recovery planning, and approval for that target.

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

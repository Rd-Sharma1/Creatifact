# Creatifact — Agent Instructions

## Project Goal

Creatifact turns a developer's engineering work into useful artifacts
such as social posts, using GitHub activity as durable engineering history.

## Architecture Principles

- The user owns architecture and product direction.
- Make small, incremental changes. Do not redesign unrelated systems.
- Prefer simple explicit architecture over premature abstraction.
- Do not introduce vector DBs, embeddings, semantic retrieval, agents,
  or other future architecture unless explicitly requested.

## Domain Model

- Repository = Creatifact's internal representation of a GitHub repository.
- ChangeSet = immutable normalized engineering activity between base/head.
- ArtifactRequest = what the user wants generated from engineering evidence.
- Artifact = generated output belonging to an ArtifactRequest.

ChangeSets answer "what happened?"
ArtifactRequests answer "what do I want made from it?"
Artifacts answer "what did Creatifact produce?"

## ChangeSets

- ChangeSets are immutable.
- ChangeSet uniqueness is `(repositoryId, basehead)`.
- GitHub IDs are external identities; Creatifact UUIDs are internal identities.
- Preserve normalized commit/change information and patches.
- Do not persist raw GitHub API responses unless explicitly requested.

## Artifact Requests

- Clients provide intent and scope, not ChangeSet IDs in normal usage.
- Creatifact resolves relevant ChangeSets server-side.
- Scope resolution is deterministic for v1.
- ArtifactRequest may reference multiple ChangeSets.
- ArtifactRequest may request multiple artifact types.
- Do not automatically generate artifacts from every GitHub webhook.
- Requests start as `PENDING`.

## Generation

- Artifact generators operate from ArtifactGenerationContext.
- Generators must not know about HTTP, Express, Inngest, or persistence.
- Generation must be idempotent per `(artifactRequestId, artifactType)`.
- One failed artifact type must not require regenerating successful types.

## Events / Inngest

- Inngest provides durable execution/retries, not domain idempotency.
- Events should carry small references rather than large domain payloads.
- Keep domain state transitions explicit.

## Database / Migrations

- Use Drizzle migrations.
- Never delete or rewrite historical migration files casually.
- Schema changes require a generated migration.
- Do not manually modify the database to compensate for migration problems
  without explicit approval.
- The local development database is disposable, but destructive DB operations
  require explicit user approval.

## Implementation Style

- Use TypeScript and existing project conventions.
- Validate HTTP input at the boundary with Zod.
- Keep database access out of domain/generator implementations.
- Avoid unrelated refactors.
- Add focused tests for new behavior.
- Before declaring work complete:
    - `npm run build`
    - `npm test`
    - `git diff --check`

## Agent Behavior

- Before making architectural changes, explain the proposed change.
- If a destructive database operation is needed, ask for confirmation.
- Do not silently broaden task scope.
- Do not add "future-proofing" abstractions without a current use case.

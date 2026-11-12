# Annotation Studio

A private annotation application for EUR-Lex, United Nations, and chemistry question–answer
evaluation. React/TypeScript frontend, `vinext` (Next.js-compatible) server, individual email/password
accounts, explicit project memberships, and SQLite on a persistent volume.

## Local development

Node 22.18 or newer is required.

```sh
npm ci
npm run build
npm run migrate
```

Create an administrator and the qualification keys without committing either:

```sh
export BOOTSTRAP_ADMIN_EMAIL=you@example.test
export BOOTSTRAP_ADMIN_NAME="Workspace administrator"
export BOOTSTRAP_ADMIN_PASSWORD='at-least-12-characters'
export QUALIFICATION_KEYS_JSON='{"version":"supplied-guidelines-v1","answers":{"legal":["…"],"chemistry":["…"]}}'
npm run bootstrap
npm run dev
```

`DATABASE_PATH` defaults to `.data/app.db`. Anonymous requests to `/`, `/admin`, and
`/account/password` redirect to `/login`. The optional sample workspace is off unless
`DEMO_ENABLED=1`; it must use `DEMO_QUALIFICATION_KEYS_JSON`, never the live key. Put the two guideline PDFs at
`guidelines/legal.pdf` and `guidelines/chemistry.pdf`; that directory is ignored by Git and copied
into the private image at build time. Open `/login`.

## Production

The public repository intentionally contains no qualification answers and no guideline PDFs. They are
provided at deploy time through Railway variables and the local `guidelines/` directory, which is
included in the image but excluded from Git. See `docs/OPERATIONS.md` for the complete contract,
deploy command, backup and restore procedure, and scaling limits.

Boot order in the container: apply migrations → seed keys and the first administrator → start the
server (under Litestream when configured). Migrations are idempotent. The health endpoint is
`/api/health`.

## Accounts and access

- Each person has an individual account. Roles come from the database; there is no public signup.
- The administrator has no project; annotators belong to exactly one project, and a project can have
  many annotators. Every server route rechecks membership and identity.
- Annotators can change their own password at `/account/password`; this revokes their other sessions.
  Administrators can reset annotator passwords, disable accounts, erase an annotator's identity
  (keeping submitted work), and create additional administrators.
- Disabled accounts cannot sign in and existing sessions stop working. Password resets and account
  erasure revoke sessions.

## Saving guarantees

Submitting saves that document immediately. One immutable row stores all eight ratings, criterion
comments, and the document comment. A unique constraint allows one submission per annotator/document
and one use of a request ID per annotator. Retries with the same request ID and payload return the
original receipt; conflicting retries return 409 and never overwrite. The save statement rechecks
membership, document existence, and the permanent project qualification. The UI only reports success
after reading the row back from the database.

## Verification

```sh
npm run typecheck
npm test
npm run build
docker build -t annotation-studio:local .
```

The test suite runs the production SQL and migrations against real SQLite, including atomic batches,
concurrent retries, membership revocation races, session rotation, password changes, and audit
records.

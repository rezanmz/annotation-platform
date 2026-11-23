# Annotation Studio

A private annotation application for EUR-Lex, United Nations, and chemistry question–answer
evaluation. React/TypeScript frontend, `vinext` (Next.js-compatible) server, individual email/password
accounts, explicit project memberships, and SQLite on a persistent volume.

## Local development

Node 22.18 or newer is required.

Run `npm ci`, then `npm run dev` and open `http://localhost:5173/login`. Startup applies the
migrations, creates 17 annotator accounts, and imports the supplied materials from the repository
root. Place `legal_annotation_guidelines.pdf`, `chemistry_annotation_guidelines.pdf`, and
`qualification-answer-keys.json` there, or set `ANNOTATION_MATERIALS_DIR` to their directory.
To create the first administrator, set these variables before starting the app.

```sh
export BOOTSTRAP_ADMIN_EMAIL=you@example.test
export BOOTSTRAP_ADMIN_NAME="Workspace administrator"
export BOOTSTRAP_ADMIN_PASSWORD='at-least-12-characters'
npm run dev
```

`DATABASE_PATH` defaults to `.data/app.db`. Anonymous requests to `/`, `/admin`, and
`/account/password` redirect to `/login`. The optional sample workspace uses `DEMO_ENABLED=1`
and its own `DEMO_QUALIFICATION_KEYS_JSON`.

## Production

For a private container build, put the same three files inside `annotation-studio/guidelines/`,
which Docker copies into the runtime image. Alternatively, point `ANNOTATION_MATERIALS_DIR` at
a mounted directory containing the files. See the [operations guide](docs/OPERATIONS.md).

The container and `npm start` apply migrations and provision accounts before serving requests.
Build once with `npm run build` before using `npm start`. The container runs under Litestream when
configured. The health endpoint is `/api/health`.

## Accounts and access

- On first startup, EUR-Lex gets four default annotators, UN gets six, and Chemistry gets seven.
  Each has one corpus-language assignment and its own random password. The private JSON config
  sits beside the database at `<DATABASE_PATH>.annotators.json`, normally `.data/app.db.annotators.json`
  locally and `/data/app.db.annotators.json` on Railway. Read the username and initial password for
  EUR-Lex French with `jq '.["eurlex/fr"]' .data/app.db.annotators.json`.
- The config records initial credentials. Restarting reuses existing accounts and respects password
  changes, reassignments, removals, and disabled accounts. Additional reviewers can share a pair.
- Each person has an individual account. Roles come from the database; there is no public signup.
- Each annotator has one active assignment. For EUR-Lex, UN, and Chemistry, select a project and a
  document language in `/admin`, then create or assign accounts under **Annotators**. Several
  reviewers can share an assignment and each sees only their own reviews.
- Under **Documents**, choose the destination language and import one UTF-8 CSV per language.
  Include `document`, `question`, and `answer` in any order. The optional `qa_id` column carries your
  original identifier into administrator exports for the selected language or the whole project.
  Other columns are ignored. A missing or blank `qa_id` exports as `null`.
  Qualification is per annotator and project. Custom projects support project-only assignments.
- Annotators can change their own password at `/account/password`; this revokes their other sessions.
  `/admin` → **Annotators** creates and assigns accounts, assigns existing accounts, resets
  passwords, disables/reactivates, removes project access, erases an identity (keeping submitted
  work), and creates additional administrators.
- `/admin` → **Projects** creates, edits, and removes projects (only when empty); each project uses
  the legal or chemistry guideline domain.
- `/admin` → **Guidelines** uploads, replaces, downloads, or removes the legal and chemistry
  guideline PDFs. SQLite stores the originals, including the final qualification page. The
  annotator reader, PDF downloads, and sample workspace show only the preceding guideline pages.
- `/admin` → **Administrators** creates and manages administrator accounts.
- Disabled accounts cannot sign in and existing sessions stop working. Password resets and account
  erasure revoke sessions.

## Saving guarantees

For all three corpora, comments are required for scores 1–3 and optional for scores 4–5.
“Cannot assess” requires a choice of missing material or insufficient expertise, plus an explanation.
For numerical fidelity, “No relevant numbers or references” records score 4 with “not applicable.”

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

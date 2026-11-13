# Operations

Production target: a single Node 22 process (`vinext` standalone) on Railway, with SQLite on the
`/data` volume. The database is the only stateful component; everything else is replaceable.

## Runtime contract

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_PATH` | yes | `/data/app.db` on Railway. The directory is created automatically. |
| `GUIDELINES_DIR` | yes | `/data/guidelines`. Seeded at boot from the private image copy when missing. |
| `QUALIFICATION_KEYS_JSON` | one-time | `{"version":"…","answers":{"legal":[…],"chemistry":[…]}}`. Seeds keys only when none exist. |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_NAME` / `BOOTSTRAP_ADMIN_PASSWORD` | one-time | Creates the first active administrator only when none exists. Remove the password variable after the first boot. |
| `TRUST_PROXY` | yes | `1` behind Railway's edge so client IPs are read from `X-Forwarded-For`. |
| `AUDIT_RETENTION_DAYS` | no | Default 365. |
| `DEMO_ENABLED` | no | Off unless `1`. The public sample workspace serves guideline PDFs and grades a test, so it must use `DEMO_QUALIFICATION_KEYS_JSON`, never the live keys. |
| `DEMO_QUALIFICATION_KEYS_JSON` | demo only | `{"answers":[…10 A–D…]}` for the sample workspace. |
| `LITESTREAM_*` | optional | Continuous SQLite replication to an S3-compatible bucket. |

## Access control

`/`, `/admin`, and `/account/password` are server-rendered redirects to `/login` when there is no valid
session; the workspace chrome is never shown to anonymous visitors. The sample workspace (`?demo=1`)
is disabled by default and its endpoints return 404 unless `DEMO_ENABLED=1`.

## Boot sequence

`entrypoint.sh` copies seed guidelines, fixes volume ownership, re-executes as `app`, applies
`drizzle/*.sql` migrations (tracked in `_omp_migrations`), seeds keys/admin, then starts the server
under Litestream when `LITESTREAM_BUCKET` is set. A failed migration aborts the container; Railway
restarts it and the health check stays red.

## Deploy

The service is configured with root directory `/annotation-studio`, Dockerfile `Dockerfile`, and
watch pattern `annotation-studio/**`. Once the Railway GitHub App is connected to
`rezanmz/annotation-platform` (branch `main`), pushes deploy automatically after CI.

Manual deploy from the repository root (keeps the private guideline PDFs in the image; preferred when
the volume needs re-seeding):

```sh
railway up -s annotation-studio -e production --ci --no-gitignore
```
Railway Config as Code (`railway.json`) is deprecated with a hard cutoff on 2026-12-01, so deploy
settings live in the Railway service: root directory `/annotation-studio`, Dockerfile build, health
check `/api/health`, `ON_FAILURE` restart, one replica. The GitHub trigger waits for CI
(`checkSuites`). The repository deliberately has no `railway.json`.

## Health and logs

- `GET /api/health` checks SQLite (`SELECT 1`) and returns 200/503.
- API failures are single-line JSON with `requestId`, error class, message, and stack.
- Railway log retention is plan-dependent (Hobby 7 days, Pro 30 days). Ship logs externally if you
  need longer retention.

## Backups

Two independent layers:

1. **Litestream to Backblaze B2** (continuous): `LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`,
   `LITESTREAM_REGION`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`,
   `LITESTREAM_PATH`, `LITESTREAM_RETENTION` (default `336h` = 14 days), and
   `LITESTREAM_SYNC_INTERVAL` (default `1s`). Every committed SQLite change is shipped as an LTX
   file within about a second; a daily full snapshot is also kept for 14 days. Restore:
   `litestream restore -config /tmp/litestream.yml -o /tmp/app.db /data/app.db`, then verify with
   `PRAGMA integrity_check` and boot the app against the restored file before switching the volume.
   B2 cost at this scale is roughly storage (<$0.01/month for a small DB) plus Class A transaction
   charges; 1 s sync is on the order of $1/month, and `LITESTREAM_SYNC_INTERVAL=10s` cuts that by
   about 10x with a ten-second RPO.
2. **Encrypted snapshots (active, plan-independent):** `GET /api/admin/backup` takes a consistent
   `VACUUM INTO` snapshot of the live database and returns the SQLite file. It requires
   `BACKUP_TOKEN` (48 random bytes, Bearer auth) and never caches. The `backup` GitHub Actions
   workflow runs daily at 03:17 UTC, verifies `PRAGMA integrity_check`, encrypts with
   `BACKUP_PASSPHRASE` (AES-256-CBC, PBKDF2 200k), and keeps a 90-day artifact. Secrets live in
   GitHub (`BACKUP_URL`, `BACKUP_TOKEN`, `BACKUP_PASSPHRASE`) and the passphrase is stored only in
   the operator's `~/.config/omp-secrets/backup-passphrase.txt`.
3. **Railway volume backups** (daily/weekly/monthly, Pro plan only): enable them in the volume's
   Backups tab when the workspace is upgraded. They cover the whole `/data` volume, including
   guideline files.

Restore from an encrypted snapshot:

1. `gh run download <run-id> -n annotation-backup-<run-id> -D restore`
2. `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in restore/app.db.enc -out restore/app.db -pass env:BACKUP_PASSPHRASE`
3. `sqlite3 restore/app.db 'PRAGMA integrity_check;'` must return `ok`.
4. Stop the service, replace `/data/app.db` through the Railway volume browser (or `railway ssh`
   with an account token), start the service, then run `npm run smoke`.

Restore procedure (tested quarterly):

1. Stop the service (or scale it to zero).
2. Restore the database from Litestream: `litestream restore -config /tmp/litestream.yml /data/app.db`
   inside a one-off container with the volume attached, or restore a volume backup in the Railway UI.
3. Start the service; migrations are idempotent and skip already-applied tags.
4. Verify `/api/health`, sign in, open one saved annotation, and export one project.
5. Keep the failed volume until the restored one is verified.

A logical dump is also produced by `sqlite3 app.db .dump` for archival; never restore a JSON project
export as a database backup.

Verify the automated layer at least monthly: run the `backup` workflow manually, download its artifact,
decrypt it, and confirm `PRAGMA integrity_check` returns `ok` and the account/submission counts match.
GitHub disables scheduled workflows after 60 days without repository activity, so a silent gap is
possible; the Pro volume backups or a Railway bucket + Litestream remove that dependency.

## Guidelines and user management

- **Guidelines:** `/admin` → **Qualification** uploads, replaces, downloads, or removes the legal and
  chemistry PDFs. Files are written atomically to `GUIDELINES_DIR`, served on the next request, and
  included in volume backups. Removing a guideline makes that domain return a clear 503 until a
  replacement is uploaded. PDFs are limited to 25 MB and validated by magic bytes.
- **Annotators:** `/admin` → **Annotators** creates and assigns accounts, assigns existing accounts,
  resets passwords, disables/reactivates, removes project access, and erases an identity (anonymizes
  the account, revokes sessions, and keeps submitted work).
- **Administrators:** the same tab lists administrators, creates additional ones, promotes
  annotators, demotes administrators back to annotators, disables/reactivates, and erases them. The
  API refuses to demote, disable, or erase the last active administrator.
- **Self-service:** every user can change their own password at `/account/password`.
- **Audit:** `GET /api/admin/audit` returns the recorded administrator and password-change actions.

## Accounts and recovery

- The admin can reset annotator passwords, disable accounts, and erase an annotator (anonymizes the
  identity, revokes sessions, keeps submitted work for research integrity).
- Every member can change their own password at `/account/password`; this revokes all other sessions.
- Administrators can create another administrator through the admin API (`action: "createAdmin"`),
  so the workspace is not dependent on one person.
- There is no email delivery. Distribute initial passwords over a secure channel and ask users to
  change them at `/account/password`.

## Scaling

SQLite is single-writer; run exactly one replica. Concurrent annotators are fine because writes are
small and seconds apart. Admin imports are the only burst: they are atomic, capped at 500 documents
and 12 MB per request. If you need multiple application replicas or cross-region writes, move to
Postgres; do not scale this service horizontally with a volume attached.

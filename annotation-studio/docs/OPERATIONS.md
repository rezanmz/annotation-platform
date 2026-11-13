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
 `railway.json` sets the Dockerfile build,
health check (`/api/health`), and restart policy.

## Health and logs

- `GET /api/health` checks SQLite (`SELECT 1`) and returns 200/503.
- API failures are single-line JSON with `requestId`, error class, message, and stack.
- Railway log retention is plan-dependent (Hobby 7 days, Pro 30 days). Ship logs externally if you
  need longer retention.

## Backups

Two independent layers:

1. **Litestream** (continuous): set `LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION`,
   `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`, and optionally `LITESTREAM_PATH`.
   The database is replicated every second with 720 h retention. This is the point-in-time layer and
   survives loss of the Railway volume.
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

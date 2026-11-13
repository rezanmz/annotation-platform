#!/bin/sh
set -eu

DATABASE_PATH="${DATABASE_PATH:-/data/app.db}"
GUIDELINES_DIR="${GUIDELINES_DIR:-/data/guidelines}"
export DATABASE_PATH GUIDELINES_DIR

# Railway mounts /data as root. Fix ownership once, then run unprivileged.
if [ "$(id -u)" = "0" ] && command -v setpriv >/dev/null 2>&1; then
  mkdir -p "$(dirname "$DATABASE_PATH")" "$GUIDELINES_DIR"
  if [ -d /app/seed-guidelines ]; then
    cp -n /app/seed-guidelines/*.pdf "$GUIDELINES_DIR/" 2>/dev/null || true
  fi
  chown -R app:app "$(dirname "$DATABASE_PATH")" "$GUIDELINES_DIR" 2>/dev/null || true
  exec setpriv --reuid=app --regid=app --init-groups /bin/sh "$0" "$@"
fi

mkdir -p "$(dirname "$DATABASE_PATH")" "$GUIDELINES_DIR"
node --experimental-strip-types --no-warnings scripts/migrate.ts
node --experimental-strip-types --no-warnings scripts/bootstrap.ts
node --experimental-strip-types --no-warnings scripts/prune.ts

if [ -n "${LITESTREAM_BUCKET:-}" ]; then
  cat > /tmp/litestream.yml <<CONFIG
snapshot:
  interval: 24h
  retention: ${LITESTREAM_RETENTION:-336h}
l0-retention: ${LITESTREAM_RETENTION:-336h}
dbs:
  - path: ${DATABASE_PATH}
    replica:
      type: s3
      url: s3://${LITESTREAM_BUCKET}/${LITESTREAM_PATH:-annotation-studio}
      region: ${LITESTREAM_REGION}
      endpoint: ${LITESTREAM_ENDPOINT}
      force-path-style: true
      sync-interval: ${LITESTREAM_SYNC_INTERVAL:-1s}
CONFIG
  exec litestream replicate -config /tmp/litestream.yml -exec "node dist/standalone/server.js"
fi

exec node dist/standalone/server.js

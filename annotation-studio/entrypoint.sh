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

if [ -n "${LITESTREAM_BUCKET:-}" ]; then
  cat > /tmp/litestream.yml <<CONFIG
dbs:
  - path: ${DATABASE_PATH}
    replicas:
      - type: s3
        bucket: ${LITESTREAM_BUCKET}
        path: ${LITESTREAM_PATH:-annotation-studio}
        endpoint: ${LITESTREAM_ENDPOINT}
        region: ${LITESTREAM_REGION:-auto}
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
        retention: 720h
        sync-interval: 1s
CONFIG
  exec litestream replicate -config /tmp/litestream.yml -exec "node dist/standalone/server.js"
fi

exec node dist/standalone/server.js

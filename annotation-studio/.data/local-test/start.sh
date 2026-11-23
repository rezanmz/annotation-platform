#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")/../.."
export DATABASE_PATH="$PWD/.data/local-test/app.db"
export GUIDELINES_DIR="$PWD/.data/local-test/guidelines"
export HOST=127.0.0.1
node22_bin="/home/mehdi/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin"
if [[ -x "$node22_bin/node" ]]; then
  export PATH="$node22_bin:$PATH"
fi
exec npm run dev

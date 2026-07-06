#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export AIRADIO_API_HOST="${AIRADIO_API_HOST:-0.0.0.0}"
export AIRADIO_API_PORT="${AIRADIO_API_PORT:-4177}"
export TZ="${TZ:-Asia/Shanghai}"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -d dist ]; then
  npm run build
fi

exec npm run start

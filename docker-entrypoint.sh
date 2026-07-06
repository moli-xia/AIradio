#!/bin/sh
set -e

storage_dir="${AIRADIO_STORAGE_DIR:-/data}"

mkdir -p "$storage_dir/audio" "$storage_dir/sound-effects"

if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$storage_dir" 2>/dev/null || true
  exec gosu node "$@"
fi

exec "$@"

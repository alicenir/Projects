#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
export DATA_DIR

if [ ! -f "$DATA_DIR/wine.db" ] && [ "${AUTO_INGEST:-1}" = "1" ]; then
  echo "No catalogue found at $DATA_DIR/wine.db — building it from the open datasets."
  echo "This downloads ~60 MB once and takes about a minute."
  node server/dist/ingest/cli.js --edition "${EDITION:-slim}"
fi

exec node server/dist/index.js

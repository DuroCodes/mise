#!/bin/sh
set -eu

mkdir -p /data/uploads

if [ "$(id -u)" = "0" ]; then
  chown -R bun:bun /data
  exec runuser -u bun -- "$@"
fi

exec "$@"

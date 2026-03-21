#!/bin/sh
set -e

./blackwall migrate
./blackwall worker &

exec ./blackwall serve --port 8000 --public-dir ./public "$@"
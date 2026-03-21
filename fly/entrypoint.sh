#!/bin/sh
set -e

# Fly release machine: one-off CMD (e.g. migrate). No queue worker — it only drains
# background jobs and is not useful on this short-lived machine.
if [ "$RELEASE_COMMAND" = "1" ]; then
  exec "$@"
fi

./blackwall migrate

# Queue worker: polls the DB and runs enqueued jobs (email, etc.).
./blackwall worker &
worker_pid=$!

term() {
  kill -TERM "$server_pid" 2>/dev/null || true
  kill -TERM "$worker_pid" 2>/dev/null || true
}
trap term INT TERM

./blackwall "$@" &
server_pid=$!

wait "$server_pid"
status=$?

kill -TERM "$worker_pid" 2>/dev/null || true
wait "$worker_pid" 2>/dev/null || true

exit "$status"

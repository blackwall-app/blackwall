#!/bin/sh
./blackwall migrate
exec "$@"
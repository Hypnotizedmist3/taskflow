#!/usr/bin/env bash
set -uo pipefail
docker rm -f taskflow-ci-db >/dev/null 2>&1 || true
exit 0

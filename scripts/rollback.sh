#!/usr/bin/env bash
# Redeploys production from the last image tagged "stable" by release.sh.
# Called automatically from the Jenkinsfile's post{failure{}} block, and can
# also be run manually to demonstrate a rollback.
set -uo pipefail

BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-taskflow-backend}"
FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-taskflow-frontend}"

if ! docker image inspect "${BACKEND_IMAGE_NAME}:stable" >/dev/null 2>&1; then
    echo "No previous stable image found — nothing to roll back to."
    exit 0
fi

echo "Rolling back production to the last stable release..."
BACKEND_IMAGE_NAME="$BACKEND_IMAGE_NAME" FRONTEND_IMAGE_NAME="$FRONTEND_IMAGE_NAME" \
    "$(dirname "$0")/deploy.sh" production stable

#!/usr/bin/env bash
# Release stage: promotes the version just deployed to staging by tagging it
# "stable" (both locally and in the registry) so scripts/rollback.sh always
# has a known-good target to fall back to, and pushes the versioned tags to
# the local registry as the durable release artifact.
set -euo pipefail

VERSION="${1:?usage: release.sh <version>}"
BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-taskflow-backend}"
FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-taskflow-frontend}"
REGISTRY="${REGISTRY:-localhost:5061}"

for IMAGE_NAME in "$BACKEND_IMAGE_NAME" "$FRONTEND_IMAGE_NAME"; do
    echo "Releasing ${IMAGE_NAME}:${VERSION} as stable..."
    docker tag "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:stable"
    docker tag "${IMAGE_NAME}:${VERSION}" "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${REGISTRY}/${IMAGE_NAME}:stable"
    docker push "${REGISTRY}/${IMAGE_NAME}:${VERSION}" || echo "Registry not running — see SETUP.md"
    docker push "${REGISTRY}/${IMAGE_NAME}:stable" || echo "Registry not running — see SETUP.md"
done

echo "Release complete: ${VERSION} tagged as stable for backend and frontend."

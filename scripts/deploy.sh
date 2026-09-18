#!/usr/bin/env bash
# Deploys the built backend + frontend images to "staging" or "production",
# each environment getting its own persistent MongoDB container (data kept
# in a named Docker volume so it survives across pipeline runs).
#
# Usage: scripts/deploy.sh <staging|production> <version-tag>
set -euo pipefail

ENV="${1:?usage: deploy.sh <staging|production> <version>}"
VERSION="${2:?usage: deploy.sh <staging|production> <version>}"
BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-taskflow-backend}"
FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-taskflow-frontend}"
NETWORK="taskflow-net"

case "$ENV" in
    staging)    BACKEND_PORT=4001; FRONTEND_PORT=4011 ;;
    production) BACKEND_PORT=4002; FRONTEND_PORT=4012 ;;
    *) echo "Unknown environment '$ENV' (expected staging|production)" >&2; exit 1 ;;
esac

DB_CONTAINER="taskflow-${ENV}-db"
BACKEND_CONTAINER="taskflow-backend-${ENV}"
FRONTEND_CONTAINER="taskflow-frontend-${ENV}"

docker network create "$NETWORK" >/dev/null 2>&1 || true

echo "Ensuring ${ENV} database is running..."
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker volume create "${DB_CONTAINER}-data" >/dev/null 2>&1 || true
    docker run -d \
        --name "$DB_CONTAINER" \
        --network "$NETWORK" \
        --network-alias "$DB_CONTAINER" \
        -v "${DB_CONTAINER}-data:/data/db" \
        mongo:7 >/dev/null
fi

echo "Waiting for ${ENV} database to be ready..."
for i in $(seq 1 30); do
    if docker exec "$DB_CONTAINER" mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "${ENV} database ready after ${i} attempt(s)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "${ENV} database did not become healthy in time" >&2
        docker logs "$DB_CONTAINER" --tail 50 || true
        exit 1
    fi
    sleep 2
done

echo "Deploying ${BACKEND_IMAGE_NAME}:${VERSION} to ${ENV} on port ${BACKEND_PORT}..."
docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
docker run -d \
    --name "$BACKEND_CONTAINER" \
    --network "$NETWORK" \
    --network-alias "$BACKEND_CONTAINER" \
    -p "${BACKEND_PORT}:3000" \
    --label "taskflow.env=${ENV}" \
    --label "taskflow.version=${VERSION}" \
    -e NODE_ENV=production \
    -e PORT=3000 \
    -e MONGO_URI="mongodb://${DB_CONTAINER}:27017/taskflow-${ENV}" \
    -e JWT_SECRET="${JWT_SECRET:-please-override-this-in-a-real-deployment}" \
    -e JWT_EXPIRES_IN=7d \
    "${BACKEND_IMAGE_NAME}:${VERSION}" >/dev/null

echo "Waiting for ${ENV} backend health check..."
BACKEND_HEALTHY=0
for i in $(seq 1 30); do
    if curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null; then
        echo "${ENV} backend healthy after ${i} attempt(s)"
        BACKEND_HEALTHY=1
        break
    fi
    sleep 3
done
if [ "$BACKEND_HEALTHY" -ne 1 ]; then
    echo "Backend health check FAILED for ${ENV} — rolling back the deploy" >&2
    docker logs "$BACKEND_CONTAINER" --tail 80 || true
    docker rm -f "$BACKEND_CONTAINER" || true
    exit 1
fi

echo "Deploying ${FRONTEND_IMAGE_NAME}:${VERSION} to ${ENV} on port ${FRONTEND_PORT}..."
docker rm -f "$FRONTEND_CONTAINER" >/dev/null 2>&1 || true
docker run -d \
    --name "$FRONTEND_CONTAINER" \
    --network "$NETWORK" \
    --network-alias "$FRONTEND_CONTAINER" \
    -p "${FRONTEND_PORT}:80" \
    --label "taskflow.env=${ENV}" \
    --label "taskflow.version=${VERSION}" \
    -e BACKEND_HOST="$BACKEND_CONTAINER" \
    "${FRONTEND_IMAGE_NAME}:${VERSION}" >/dev/null

echo "Waiting for ${ENV} frontend health check..."
for i in $(seq 1 20); do
    if curl -sf "http://localhost:${FRONTEND_PORT}/health" > /dev/null; then
        echo "${ENV} frontend healthy after ${i} attempt(s): http://localhost:${FRONTEND_PORT}"
        echo "${ENV} backend API: http://localhost:${BACKEND_PORT}"
        exit 0
    fi
    sleep 2
done

echo "Frontend health check FAILED for ${ENV} — rolling back the deploy" >&2
docker logs "$FRONTEND_CONTAINER" --tail 80 || true
docker rm -f "$FRONTEND_CONTAINER" || true
exit 1

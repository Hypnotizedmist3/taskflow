#!/usr/bin/env bash
# Test stage: starts a real, disposable MongoDB container (mirroring how a
# managed CI service would provide one) and runs the backend's Jest +
# Supertest integration suite against it inside the backend's own "dev"
# Docker image — the same image Build already produced, so what's tested is
# exactly what got built, not a re-install on the Jenkins agent.
set -euo pipefail

DEV_IMAGE="${DEV_IMAGE:?DEV_IMAGE must be set (e.g. taskflow-backend-dev:1.0.42)}"
NETWORK="taskflow-net"

docker network create "$NETWORK" >/dev/null 2>&1 || true

echo "Starting ephemeral test MongoDB..."
docker rm -f taskflow-ci-db >/dev/null 2>&1 || true
docker run -d \
    --name taskflow-ci-db \
    --network "$NETWORK" \
    --network-alias taskflow-ci-db \
    mongo:7 >/dev/null

echo "Waiting for MongoDB to accept connections..."
for i in $(seq 1 30); do
    if docker exec taskflow-ci-db mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "MongoDB ready after ${i} attempt(s)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "MongoDB did not become healthy in time" >&2
        docker logs taskflow-ci-db --tail 50 || true
        exit 1
    fi
    sleep 2
done

echo "Running backend integration test suite..."
docker run --rm \
    --network "$NETWORK" \
    -e NODE_ENV=test \
    -e MONGO_URI=mongodb://taskflow-ci-db:27017/taskflow-test \
    -e JWT_SECRET=ci-test-secret-not-for-production \
    "$DEV_IMAGE" \
    npm test

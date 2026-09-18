#!/usr/bin/env bash
# Security stage: Trivy filesystem scan (dependency vulnerabilities) plus an
# image scan of both built images (OS packages + app layer).
set -uo pipefail

BACKEND_IMAGE="${BACKEND_IMAGE:?BACKEND_IMAGE must be set (e.g. taskflow-backend:1.0.42)}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:?FRONTEND_IMAGE must be set (e.g. taskflow-frontend:1.0.42)}"

mkdir -p reports

echo "Scanning filesystem dependencies (backend)..."
trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 0 \
    --format json --output reports/trivy-fs-backend.json backend

echo "Scanning filesystem dependencies (frontend)..."
trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 0 \
    --format json --output reports/trivy-fs-frontend.json frontend

echo "Scanning built backend image: ${BACKEND_IMAGE}"
trivy image --severity HIGH,CRITICAL --exit-code 0 \
    --format json --output reports/trivy-image-backend.json "${BACKEND_IMAGE}"

echo "Scanning built frontend image: ${FRONTEND_IMAGE}"
trivy image --severity HIGH,CRITICAL --exit-code 0 \
    --format json --output reports/trivy-image-frontend.json "${FRONTEND_IMAGE}"

echo "Security scan complete — reports in reports/trivy-*.json"
exit 0

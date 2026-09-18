#!/usr/bin/env bash
# Monitoring stage: confirms staging (deployed automatically by this
# pipeline) is actually reachable, and reports on production/the monitoring
# stack if they're already running. Production is deployed once, manually,
# per SETUP.md — so it (and the monitoring stack that watches it) not being
# up yet on a first run is informational, not a pipeline failure.
set -uo pipefail

STATUS=0

check() {
    local name="$1" url="$2" required="$3"
    if curl -sf "$url" > /dev/null; then
        echo "OK   ${name} (${url})"
    else
        echo "${required} ${name} (${url})"
        if [ "$required" = "FAIL" ]; then
            STATUS=1
        fi
    fi
}

check "staging backend"     "http://localhost:4001/health" "FAIL"
check "staging frontend"    "http://localhost:4011/health" "FAIL"
check "production backend"  "http://localhost:4002/health" "WARN"
check "production frontend" "http://localhost:4012/health" "WARN"

if docker ps --format '{{.Names}}' | grep -qx taskflow-prometheus; then
    echo "Prometheus targets:"
    curl -s http://localhost:4090/api/v1/targets \
        | grep -o '"health":"[a-z]*"' \
        | sort | uniq -c || true
else
    echo "Monitoring stack not running yet — see SETUP.md step 7 (docker compose -f docker-compose.monitoring.yml up -d)"
fi

exit $STATUS

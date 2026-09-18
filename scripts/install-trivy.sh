#!/usr/bin/env bash
# Installs Trivy (container/image vulnerability scanner) if it isn't already
# on PATH. Idempotent — safe to call at the start of every Security stage.
set -euo pipefail

if command -v trivy >/dev/null 2>&1; then
    echo "Trivy already installed: $(trivy --version | head -1)"
    exit 0
fi

if command -v brew >/dev/null 2>&1; then
    echo "Installing Trivy via Homebrew..."
    brew install trivy
else
    echo "Homebrew not found — installing Trivy via the official install script..."
    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
        | sh -s -- -b /usr/local/bin
fi

trivy --version

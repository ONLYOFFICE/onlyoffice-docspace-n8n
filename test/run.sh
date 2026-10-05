#!/usr/bin/env bash
# Run the tests: `unit`, `automation` (against the DocSpace portal given by DOC_SPACE_BASE_URL,
# DOC_SPACE_USERNAME and DOC_SPACE_PASSWORD) or both when no argument is given. CI runs this
# script in node:24 containers; test/docker.sh runs it the same way locally.
set -euo pipefail
cd "$(dirname "$0")/.."

SUITE=${1:-all}
N8N_VERSION=2.40.7
CLOUDFLARED_VERSION=2026.9.3
PNPM_VERSION=$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)

npm install --global --no-fund --no-audit --loglevel=error "pnpm@$PNPM_VERSION" >/dev/null
pnpm install --frozen-lockfile

if [ "$SUITE" != automation ]; then
  pnpm test
fi

if [ "$SUITE" != unit ]; then
  npm install --global --no-fund --no-audit --loglevel=error "n8n@$N8N_VERSION" >/dev/null
  # The trigger test gets a public webhook URL for n8n from a Cloudflare quick tunnel.
  curl --fail --silent --show-error --location --output /usr/local/bin/cloudflared \
    "https://github.com/cloudflare/cloudflared/releases/download/$CLOUDFLARED_VERSION/cloudflared-linux-$(dpkg --print-architecture)"
  chmod +x /usr/local/bin/cloudflared
  pnpm build
  pnpm test:automation
fi

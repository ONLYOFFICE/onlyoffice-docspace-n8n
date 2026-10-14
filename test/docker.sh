#!/usr/bin/env bash
# Run test/run.sh locally the way CI does, in a node:24 container; the arguments go to run.sh.
# The test portal is given by DOC_SPACE_BASE_URL, DOC_SPACE_USERNAME and DOC_SPACE_PASSWORD.
set -euo pipefail
cd "$(dirname "$0")/.."

# The repository is copied into the container so that node_modules is built for Linux.
# MSYS_NO_PATHCONV and cygpath keep the paths intact in Git Bash on Windows.
MSYS_NO_PATHCONV=1 docker run --rm \
  --env DOC_SPACE_BASE_URL --env DOC_SPACE_USERNAME --env DOC_SPACE_PASSWORD \
  --volume "$(cygpath -m "$PWD" 2>/dev/null || pwd):/src:ro" \
  --volume onlyoffice-docspace-n8n-tests-npm:/root/.npm \
  node:24-bookworm bash -c \
  'mkdir /work && tar -C /src --exclude=./node_modules --exclude=./dist -cf - . | tar -C /work -xf - && bash /work/test/run.sh "$@"' \
  run.sh "$@"

#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer must be run on the DGX Linux host." >&2
  exit 1
fi

: "${GITHUB_RUNNER_TOKEN:?Set GITHUB_RUNNER_TOKEN to a short-lived repository runner token.}"

REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/smihara-ux/ECodump-New}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)-dgx}"
RUNNER_ROOT="${RUNNER_ROOT:-$HOME/actions-runner-ecodump}"
RUNNER_VERSION="${RUNNER_VERSION:-2.337.0}"

mkdir -p "$RUNNER_ROOT"
cd "$RUNNER_ROOT"

if [[ ! -x ./config.sh ]]; then
  archive="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  curl --fail --location --retry 3 \
    --output "$archive" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${archive}"
  tar xzf "$archive"
fi

./config.sh \
  --unattended \
  --replace \
  --url "$REPOSITORY_URL" \
  --token "$GITHUB_RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "dgx" \
  --work "_work"

if command -v systemctl >/dev/null 2>&1; then
  ./svc.sh install
  ./svc.sh start
  ./svc.sh status
else
  echo "Runner configured. Start it with: $RUNNER_ROOT/run.sh"
fi

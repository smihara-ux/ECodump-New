#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer must be run on the DGX Linux host." >&2
  exit 1
fi

: "${GITHUB_RUNNER_TOKEN:?Set GITHUB_RUNNER_TOKEN to a short-lived repository runner token.}"

REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/smihara-ux/ECodump-New}"
RUNNER_POOL_SIZE="${RUNNER_POOL_SIZE:-8}"
RUNNER_ROOT="${RUNNER_ROOT:-$HOME/actions-runner-ecodump}"
RUNNER_VERSION="${RUNNER_VERSION:-2.337.0}"
RUNNER_PREFIX="${RUNNER_PREFIX:-$(hostname)-dgx}"

if ! [[ "$RUNNER_POOL_SIZE" =~ ^[1-8]$ ]]; then
  echo "RUNNER_POOL_SIZE must be between 1 and 8." >&2
  exit 1
fi

download_root="$(mktemp -d)"
trap 'rm -rf "$download_root"' EXIT
archive="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

curl --fail --location --retry 3 \
  --output "$download_root/$archive" \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${archive}"

for worker in $(seq 1 "$RUNNER_POOL_SIZE"); do
  runner_dir="${RUNNER_ROOT}-${worker}"
  runner_name="${RUNNER_PREFIX}-${worker}"
  mkdir -p "$runner_dir"

  if [[ ! -x "$runner_dir/config.sh" ]]; then
    tar xzf "$download_root/$archive" -C "$runner_dir"
  fi

  (
    cd "$runner_dir"
    ./config.sh \
      --unattended \
      --replace \
      --url "$REPOSITORY_URL" \
      --token "$GITHUB_RUNNER_TOKEN" \
      --name "$runner_name" \
      --labels "dgx,dgx-worker-${worker}" \
      --work "_work"

    if command -v systemctl >/dev/null 2>&1; then
      sudo ./svc.sh install "${USER}"
      sudo ./svc.sh start
    else
      nohup ./run.sh >"runner-${worker}.log" 2>&1 &
    fi
  )
done

echo "Configured ${RUNNER_POOL_SIZE} DGX runner services."
echo "Verify them at: ${REPOSITORY_URL}/settings/actions/runners"


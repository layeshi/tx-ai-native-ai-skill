#!/usr/bin/env bash
set -euo pipefail

: "${PLATFORM_BASE_URL:?Set PLATFORM_BASE_URL to the Tx-AI root URL}"
: "${PLATFORM_AGENT_TOKEN:?Set PLATFORM_AGENT_TOKEN to a personal txai_ credential}"

case "$PLATFORM_AGENT_TOKEN" in
  txai_*) ;;
  *) echo 'PLATFORM_AGENT_TOKEN must start with txai_' >&2; exit 2 ;;
esac

base="${PLATFORM_BASE_URL%/}"
auth=(-H "Authorization: Bearer $PLATFORM_AGENT_TOKEN" -H 'Accept: application/json')

identity="$(curl --fail-with-body --silent --show-error "${auth[@]}" "$base/api/ai/identity")"
capabilities="$(curl --fail-with-body --silent --show-error "${auth[@]}" "$base/api/ai/capabilities")"

printf '%s\n' "$identity" | jq -e . >/dev/null
printf '%s\n' "$capabilities" | jq -e . >/dev/null
printf 'Tx-AI authorization verified. Identity and capabilities are available.\n'

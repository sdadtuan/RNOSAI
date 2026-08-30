#!/usr/bin/env bash
set -euo pipefail

MIN="${PTT_SALES_KIT_LORA_MIN_PAIRS:-200}"
ENABLED="${PTT_SALES_KIT_LORA_ENABLED:-0}"
FILE="${1:-/dev/stdin}"

if [[ ! -f "$FILE" && "$FILE" != "/dev/stdin" ]]; then
  echo "refused: file not found: $FILE" >&2
  exit 1
fi

PAIRS=$(grep -c '"assistant"' "$FILE" 2>/dev/null || true)

if [[ "$ENABLED" != "1" ]]; then
  echo "refused: PTT_SALES_KIT_LORA_ENABLED!=1" >&2
  exit 2
fi

if (( PAIRS < MIN )); then
  echo "refused: pairs=$PAIRS min=$MIN" >&2
  exit 3
fi

echo "OK would train pairs=$PAIRS (implement on GPU host — no nest)"
echo "Next: run LoRA on GPU machine; record MODEL_CARD.md with date, N=$PAIRS, dataset sha256."
exit 0

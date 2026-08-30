#!/usr/bin/env bash
# LoRA export gate for CEO Command — mirrors sales_kit_lora_train.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
export PTT_CEO_COMMAND_LORA_ENABLED="${PTT_CEO_COMMAND_LORA_ENABLED:-0}"
export PTT_CEO_COMMAND_LORA_MIN_PAIRS="${PTT_CEO_COMMAND_LORA_MIN_PAIRS:-200}"
node -e "
const { canStartLora } = require('./dist/intake/sales-kit-learn-export.util');
const pairs = Number(process.env.PTT_CEO_COMMAND_LORA_PAIRS || 0);
const r = canStartLora({
  pairs,
  minPairs: Number(process.env.PTT_CEO_COMMAND_LORA_MIN_PAIRS),
  enabled: process.env.PTT_CEO_COMMAND_LORA_ENABLED === '1',
});
if (!r.ok) { console.error(r.error); process.exit(r.error.includes('ENABLED') ? 2 : 3); }
console.log('OK pairs=' + pairs);
"

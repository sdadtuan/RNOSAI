#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for f in deploy/systemd/ptt-crm-am-renewal.service deploy/systemd/ptt-crm-am-renewal.timer; do
  test -f "$root/$f" || { echo "MISSING $f" >&2; exit 1; }
done
grep -q 'run_am_job.js renewal' "$root/deploy/systemd/ptt-crm-am-renewal.service"
echo OK

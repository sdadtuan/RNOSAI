#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

for f in \
  deploy/systemd/ptt-crm-am-health.service \
  deploy/systemd/ptt-crm-am-health.timer \
  deploy/systemd/ptt-crm-am-renewal.service \
  deploy/systemd/ptt-crm-am-renewal.timer
do
  test -f "$root/$f" || { echo "MISSING $f" >&2; exit 1; }
done

health_svc="$root/deploy/systemd/ptt-crm-am-health.service"
renewal_svc="$root/deploy/systemd/ptt-crm-am-renewal.service"
health_timer="$root/deploy/systemd/ptt-crm-am-health.timer"
renewal_timer="$root/deploy/systemd/ptt-crm-am-renewal.timer"

grep -q 'run_am_job.js health' "$health_svc"
grep -q 'run_am_job.js renewal' "$renewal_svc"

for svc in "$health_svc" "$renewal_svc"; do
  grep -q '^User=deploy$' "$svc" || { echo "FAIL $svc User" >&2; exit 1; }
  grep -q '^EnvironmentFile=-/var/www/rnosai/.env$' "$svc" || { echo "FAIL $svc EnvironmentFile" >&2; exit 1; }
  grep -q '^WorkingDirectory=/var/www/rnosai/services/ptt-crm-api$' "$svc" || { echo "FAIL $svc WorkingDirectory" >&2; exit 1; }
  if grep -q 'User=www-data' "$svc" || grep -q '/services/ptt-crm-api/.env' "$svc"; then
    echo "FAIL $svc still pins www-data or API-local .env" >&2
    exit 1
  fi
done

grep -qF 'OnCalendar=*-*-* 02:00:00 Asia/Ho_Chi_Minh' "$health_timer" || {
  echo "FAIL health timer OnCalendar" >&2
  exit 1
}
grep -qF 'OnCalendar=*-*-* 06:00:00 Asia/Ho_Chi_Minh' "$renewal_timer" || {
  echo "FAIL renewal timer OnCalendar" >&2
  exit 1
}
if grep -E '19:00:00|23:00:00' "$health_timer" "$renewal_timer"; then
  echo "FAIL timers still encode UTC fallback" >&2
  exit 1
fi

echo OK

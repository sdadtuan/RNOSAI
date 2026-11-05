#!/usr/bin/env bash
# Staging ops-web at https://rs.pttads.vn/test (basePath /test, port 3201).
set -euo pipefail

# shellcheck source=ops_web_standalone.sh
. "$(dirname "${BASH_SOURCE[0]}")/ops_web_standalone.sh"

export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/test}"
export OPS_WEB_STAGING_PORT="${OPS_WEB_STAGING_PORT:-3201}"

ops_web_staging_current_link() {
  printf '%s/current/ops-web-staging\n' "$(ops_web_root)"
}

ops_web_staging_build() {
  export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/test}"
  ops_web_build
}

ops_web_assert_release_ready() {
  local release_path="$1"
  if [[ ! -f "$release_path/server.js" ]]; then
    echo "FAIL  release missing server.js: $release_path"
    return 1
  fi
  local static_dir="$release_path/.next/static/chunks"
  if [[ ! -d "$static_dir" ]] || [[ "$(find "$static_dir" -maxdepth 1 -name '*.js' 2>/dev/null | wc -l | tr -d ' ')" -lt 3 ]]; then
    echo "FAIL  release missing .next/static/chunks: $release_path"
    return 1
  fi
  echo "OK  release ready: $release_path"
}

ops_web_publish_staging_release() {
  local root release_id release_path
  root="$(ops_web_root)"
  release_id="staging-$(git -C "$root" rev-parse --short HEAD 2>/dev/null || echo manual)-$(date +%Y%m%d%H%M%S)"
  release_path="$root/releases/ops-web-$release_id"

  mkdir -p "$root/releases" "$root/current"
  rm -rf "$release_path"
  mkdir -p "$release_path"
  rsync -a --delete "$(ops_web_dir)/.next/standalone/" "$release_path/"
  ops_web_assert_release_ready "$release_path"
  ops_web_activate_staging_release "$release_path"
  echo "OK  staging release published → $release_path"
  printf '%s\n' "$release_path"
}

ops_web_activate_staging_release() {
  local release_path="${1:-}"
  local root current_link resolved
  root="$(ops_web_root)"
  current_link="$(ops_web_staging_current_link)"
  if [[ -z "$release_path" ]]; then
    release_path="$(ls -1dt "$root/releases/ops-web-staging-"* 2>/dev/null | head -1 || ls -1dt "$root/releases/ops-web-staging"* 2>/dev/null | head -1 || true)"
  fi
  if [[ -z "$release_path" || ! -d "$release_path" ]]; then
    echo "FAIL  no staging release under $root/releases/"
    return 1
  fi
  ops_web_assert_release_ready "$release_path"
  mkdir -p "$root/current"
  ln -sfn "$release_path" "$current_link"
  resolved="$(readlink -f "$current_link" 2>/dev/null || readlink "$current_link" 2>/dev/null || true)"
  if [[ "$resolved" != "$release_path" ]]; then
    echo "WARN  could not update $current_link"
    return 1
  fi
  echo "OK  staging active → $release_path"
}

ops_web_staging_verify_local() {
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${OPS_WEB_STAGING_PORT}/test/crm/leads")"
  echo "staging :${OPS_WEB_STAGING_PORT}/test/crm/leads → HTTP $code"
  [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]
}

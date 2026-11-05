#!/usr/bin/env bash
# Shared portal-web standalone helpers (source from rebuild / postbuild / systemd).
set -euo pipefail

portal_web_root() {
  local root="${RNOSAI_ROOT:-}"
  if [[ -z "$root" ]]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi
  printf '%s\n' "$root"
}

portal_web_dir() {
  printf '%s/services/portal-web\n' "$(portal_web_root)"
}

portal_web_static_dir() {
  printf '%s/.next/standalone/.next/static\n' "$(portal_web_dir)"
}

portal_web_public_dir() {
  printf '%s/.next/standalone/public\n' "$(portal_web_dir)"
}

portal_web_verify_static() {
  local static_dir="${1:-$(portal_web_static_dir)}"
  local public_dir css_file css_name chunk_count

  css_file="$(ls "$static_dir"/css/*.css 2>/dev/null | head -1 || true)"
  if [[ -z "$css_file" ]]; then
    echo "FAIL  $static_dir/css missing — copy .next/static into standalone before start"
    return 1
  fi

  css_name="$(basename "$css_file")"
  chunk_count="$(find "$static_dir/chunks" -maxdepth 1 -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$chunk_count" -lt 5 ]]; then
    echo "FAIL  $static_dir/chunks has only $chunk_count js files"
    return 1
  fi

  public_dir="$(portal_web_public_dir)"
  if [[ ! -f "$public_dir/capacitor-native-bridge.js" ]]; then
    echo "FAIL  $public_dir/capacitor-native-bridge.js missing"
    return 1
  fi

  echo "OK  portal static verified ($css_name, $chunk_count chunks)"
}

portal_web_sync_static() {
  local app_dir static_dir
  app_dir="$(portal_web_dir)"
  static_dir="$(portal_web_static_dir)"
  cd "$app_dir"

  if [[ ! -d .next/static ]]; then
    echo "FAIL  $app_dir/.next/static missing — run next build first"
    return 1
  fi

  mkdir -p .next/standalone/.next
  rm -rf .next/standalone/.next/static.new
  cp -r .next/static .next/standalone/.next/static.new
  if [[ -d .next/standalone/.next/static ]]; then
    mv .next/standalone/.next/static .next/standalone/.next/static.old
  fi
  mv .next/standalone/.next/static.new .next/standalone/.next/static
  rm -rf .next/standalone/.next/static.old

  if [[ -d public ]]; then
    rm -rf .next/standalone/public.new
    cp -r public .next/standalone/public.new
    if [[ -d .next/standalone/public ]]; then
      mv .next/standalone/public .next/standalone/public.old
    fi
    mv .next/standalone/public.new .next/standalone/public
    rm -rf .next/standalone/public.old
  fi

  portal_web_verify_static "$static_dir"
}

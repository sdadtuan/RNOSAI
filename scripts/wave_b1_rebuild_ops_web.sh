#!/usr/bin/env bash
# Rebuild ops-web only (deploy user — NO systemctl, no polkit prompt).
# After this, run: sudo ./scripts/wave_b1_fix_static_sudo.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
PWA_ENABLED="${NEXT_PUBLIC_PWA_ENABLED:-1}"
STATIC_DIR="$ROOT/services/ops-web/.next/standalone/.next/static"

cd "$ROOT/services/ops-web"
echo "== Rebuild ops-web (deploy) =="
echo "NEXT_PUBLIC_PTT_API_URL=$OPS_API_URL"
echo "NEXT_PUBLIC_PWA_ENABLED=$PWA_ENABLED"
git -C "$ROOT" log -1 --oneline

ensure_ops_pwa_icons() {
  local icons_dir="$ROOT/services/ops-web/public/icons"
  local missing=0
  for size in 192 512; do
    if [[ ! -f "$icons_dir/icon-${size}.png" ]]; then
      missing=1
    fi
  done

  if [[ "$missing" == "0" && "${OPS_PWA_REGEN_ICONS:-0}" != "1" ]]; then
    echo "OK  PWA icons present (skip generate; OPS_PWA_REGEN_ICONS=1 to force)"
    return 0
  fi

  if python3 "$ROOT/scripts/generate_ops_pwa_icons.py"; then
    return 0
  fi

  echo "WARN  Pillow missing — install once (linuxuser): sudo apt install -y python3-pil"
  if command -v apt-get >/dev/null 2>&1 && [[ "${OPS_PWA_TRY_APT:-0}" == "1" ]]; then
    sudo apt-get install -y python3-pil
    python3 "$ROOT/scripts/generate_ops_pwa_icons.py" && return 0
  fi

  if [[ "$missing" == "0" ]]; then
    echo "WARN  icon generate failed; using existing PNG icons in public/icons/"
    return 0
  fi

  echo "FAIL  PWA icons missing and could not generate."
  echo "      Fix (linuxuser): sudo apt install -y python3-pil"
  echo "      Or skip icons and rebuild ops-web manually (icons already in git)."
  exit 1
}
ensure_ops_pwa_icons

npm ci
export NEXT_PUBLIC_PTT_API_URL="$OPS_API_URL"
export NEXT_PUBLIC_PWA_ENABLED="$PWA_ENABLED"
npm run build

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
fi

css_file="$(ls "$STATIC_DIR"/css/*.css 2>/dev/null | head -1 || true)"
if [[ -z "$css_file" ]]; then
  echo "FAIL  $STATIC_DIR/css missing after copy"
  exit 1
fi
css_name="$(basename "$css_file")"
echo "OK  static copied ($css_name)"
ls -la "$css_file"

echo ""
echo "============================================"
echo " BƯỚC TIẾP — bắt buộc sudo (linuxuser)"
echo " KHÔNG chọn identity deploy khi polkit hỏi."
echo "============================================"
echo ""
echo "  sudo $ROOT/scripts/wave_b1_fix_static_sudo.sh"
echo ""
echo "(Nhập password của user linuxuser khi sudo hỏi)"
echo ""

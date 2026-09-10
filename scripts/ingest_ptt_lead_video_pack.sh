#!/usr/bin/env bash
# Stub: ingest 4 PTT Lead Video MP4s into Creative OS with lead_social QC gate.
# Full implementation (Phase A): upload DAM → create versions → POST QC with pack=lead_social.
# Exit 1 if any version qc_status != passed (launch block in Ads Ops).
#
# Usage (future):
#   ./scripts/ingest_ptt_lead_video_pack.sh /path/to/docs/creative/ptt-fb-lead/mp4
#
# QC facts SoT: docs/creative/ptt-fb-lead/qc-facts.example.json
# Guide: docs/huong-dan-su-dung/36-ptt-fb-lead-video.md
set -euo pipefail

echo "== ingest_ptt_lead_video_pack.sh (stub) =="
echo "QC gate: runCpVideoQc with pack=lead_social; blocked ⇒ exit 1."
echo "Hooks: h1–h4 · 9:16 · 15s · Instant Form CTA."
echo ""
echo "Steps (not automated in stub):"
echo "  1. Ensure project 'PTT Lead Performance' exists in Creative OS"
echo "  2. Upload 4 MP4 to DAM / ingest (MIME video/mp4)"
echo "  3. Create CP video versions linked to lead_social_916 playbook"
echo "  4. POST /api/crm/cp/videos/versions/:id/qc body { pack: lead_social, lead_video: {...} }"
echo "  5. Fail if any overall=blocked before Ads Ops launch"
echo ""
echo "Set IMPLEMENT=1 when worker script is wired (Phase A extended)."
if [[ "${IMPLEMENT:-0}" == "1" ]]; then
  echo "IMPLEMENT=1 not yet supported in this stub." >&2
  exit 2
fi
exit 0

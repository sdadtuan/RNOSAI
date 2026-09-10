#!/usr/bin/env bash
set -euo pipefail
file="${1:?usage: probe_ptt_fb_lead_video.sh /path/to.mp4}"
if [[ ! -f "$file" ]]; then
  echo "missing_file" >&2
  exit 1
fi
width="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$file")"
height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$file")"
duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file")"
audio_streams="$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$file" | wc -l | tr -d ' ')"
python3 - "$file" "$width" "$height" "$duration" "$audio_streams" <<'PY'
import json, sys
path, width, height, duration, audio = sys.argv[1:6]
print(json.dumps({
  "filename": path.split("/")[-1],
  "width": int(width),
  "height": int(height),
  "duration_sec": round(float(duration), 3),
  "has_audio": int(audio) > 0,
}, ensure_ascii=False))
PY

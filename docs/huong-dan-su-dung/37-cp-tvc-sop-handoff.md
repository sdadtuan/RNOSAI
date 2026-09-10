# TVC ngắn — Dual module Creative OS + Video SOP (Phase A)

> **Playbook:** `tvc_short_169` · **QC pack:** `tvc_short` · **Ratio:** 16:9  
> **Phase A:** governance + ingest hook; render cinematic thật ở Phase B.

## Hai module

| Module | Vai trò Phase A |
|---|---|
| **Creative OS** (`/crm/creative-os`) | Playbook picker, QC pack `tvc_short`, version ingest, legal gate |
| **Video SOP** (`/crm/video`) | Quay / cinematic / con người — render MP4 master |

Phase A **không** wire SOP worker → CP render. Luồng: SOP hoàn thành → upload version vào CP → QC → duyệt.

## 5 bước handoff

1. Chọn playbook **Brand TVC ngắn · 16:9** trong Studio hoặc batch.
2. Banner Studio: **Mở Video SOP** — tạo job cinematic nếu cần footage thật.
3. Khi có MP4: ingest vào DAM + gắn CP video version (project TVC).
4. Chạy QC với `pack=tvc_short` — block nếu claim chưa `legal_approved`.
5. Export / publish chỉ khi QC passed (không blocked).

## Phase B

- Bridge SOP job complete → auto-ingest version + ffprobe facts.
- Closed-loop CPL theo `re_project_id` trên RPT.

**Liên quan:** [34-creative-production-os.md](./34-creative-production-os.md) · [36-ptt-fb-lead-video.md](./36-ptt-fb-lead-video.md)

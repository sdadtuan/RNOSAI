# Contributing — RNOSAI

**Repository:** https://github.com/sdadtuan/RNOSAI

## Trước khi code

1. Mở **issue:** https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml — map RNOS ↔ UC ↔ UI ↔ UAT.
2. Branch: `feat/RNOS-XX-short-name` hoặc `fix/...` cho bug.

## Pull request

- PR tự load [pull_request_template.md](https://github.com/sdadtuan/RNOSAI/blob/main/.github/pull_request_template.md).
- Tick checklist: [pr-checklist-rnos-uc-ui-uat.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md).
- Title: `RNOS-XX: mô tả ngắn`.
- Body: `Closes #issue-number`.

## UAT / gap

- UAT fail → https://github.com/sdadtuan/RNOSAI/issues/new?template=uat-gap.yml
- Production bug → https://github.com/sdadtuan/RNOSAI/issues/new?template=bug-report.yml

## Clone & labels

```bash
git clone https://github.com/sdadtuan/RNOSAI.git
cd RNOSAI
chmod +x scripts/github_labels.sh
./scripts/github_labels.sh sdadtuan/RNOSAI
```

Chi tiết: [github-setup.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/github-setup.md).

## Spec bắt buộc đọc (AI R1)

| Doc | Link |
|-----|------|
| Master spec entry | [SPEC_RNOSAI_MASTER.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/SPEC_RNOSAI_MASTER.md) |
| Implementation plan | [2026-07-26-rnosai-system-implementation-plan.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/specs/2026-07-26-rnosai-system-implementation-plan.md) |
| UAT actions | [09-AI-ACTIONS.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/use-cases/actions/09-AI-ACTIONS.md) |
| UI Copilot | [SPEC_UI_UX_AI_REVENUE_OS.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/SPEC_UI_UX_AI_REVENUE_OS.md) |

**Business rules AI:** BR-AI-01 (no auto-send) … BR-AI-05 (no PII logs) — [PR checklist §F](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md#f-business-rules-bắt-buộc).

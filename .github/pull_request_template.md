## RNOS ↔ UC ↔ UI ↔ UAT

**Repo:** https://github.com/sdadtuan/RNOSAI

> Checklist đầy đủ: [docs/templates/pr-checklist-rnos-uc-ui-uat.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md)

| RNOS | UC | Actions § | UI spec | UAT / Gate |
|------|-----|-----------|---------|------------|
| RNOS-__ | AI-UC-___ | [§___](https://github.com/sdadtuan/RNOSAI/blob/main/docs/use-cases/actions/09-AI-ACTIONS.md) | §___ / UI-R1-__ | Pilot §__ |

**Wave:** Phase 0 / R1 · **Workstream:** DATA / BE / FE / PLATFORM / QA

## Summary

<!-- 1–3 câu: what + why -->

## Changes

-

## Author checklist

- [ ] PR title `RNOS-XX: …` hoặc RNOS liệt kê rõ
- [ ] Tick block RNOS trong [checklist doc](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md#d-checklist-theo-rnos-r1--phase-0)
- [ ] Tests added/updated (hoặc ghi lý do skip)
- [ ] Staging verified — link/log:
- [ ] `PTT_AI_COPILOT_ENABLED=0` → CRM không regression
- [ ] Không commit secrets / `.env` prod

## Reviewer checklist

- [ ] RNOS → UC → UI map đúng [ma trận R1](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md#c-ma-trận-nhanh-rnos--uc--ui--uat-r1)
- [ ] BR-AI-01…05 ([business rules](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md#f-business-rules-bắt-buộc))
- [ ] LLM/score PR → `ai_agent_runs` 100% (RNOS-05)
- [ ] ops-web PR → BR-AI-01 no send · BR-AI-02 confidence banner

## UAT / QA (staging)

- [ ] Actions bước: …
- [ ] Evidence: screenshot / SQL / E2E

## Rollback

<!-- flag OFF · redeploy · DDL N/A -->

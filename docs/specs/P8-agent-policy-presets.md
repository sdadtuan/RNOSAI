# P8 agent policy presets

Extend strategist / PM allowlists with:

- `service.recommend_from_signals`
- `consult.draft_from_research`
- `presales.return_to_am`
- `proposal.draft_from_consult`

## Gate copy (locked)

- **Consult:** `Đủ Tư vấn: BANT ≥ 24 + Pain (validated|assumed_confirmed) + Dịch vụ (selected|recommended_confirmed) + Go` — **no TMMT≥9**
- **Winning:** `Winning gate: TMMT ≥ 6/12 + đủ 4 core + geo + Insight approved`

## Try samples (fixtures)

### A Hưng 360 / Lead #5 / lifecycle #5

```json
{
  "lead_id": 5,
  "lifecycle_id": 5,
  "signals": {
    "industry": "auto detailing",
    "customer_utterance": "chưa biết dịch vụ nào phù hợp",
    "use_crm_similar_cases": true,
    "use_web_research": true
  },
  "dry_run": true
}
```

Expect: `service_status=recommended_draft`, never `selected`.

### consult.draft_from_research

```json
{
  "lifecycle_id": 5,
  "lead_id": 5,
  "overwrite_mode": "fill_empty_only",
  "dry_run": true
}
```

Expect: `fields_written` with `assumed_draft`; `consult_ready_preview=false` until AM Confirm.

### After Confirm Assumed

Pain + Service confirmed + BANT≥24 + Go → `consult_ready=true`.

Winning still needs TMMT 6/12 + 4 core confirmed + geo + approved insight; `plan.breakdown_to_roles` stays **409** `winning_plan_gate_failed`.

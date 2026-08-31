# Intake Win-score Phase 2 — Design Spec

> **Document ID:** INT-WIN-P2-20260831  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-31  
> **Trạng thái:** Implemented  
> **Route:** `/crm/intake?lead_id=` · Funnel Consult advance  
> **Parent:** [INT-BANT-CL-P1](./2026-08-30-intake-bant-checklist-phase1-design.md) · [INT-SK](./2026-08-29-intake-deal-bar-sales-kit-design.md)  
> **Quyết định:** BANT = đủ **Tư vấn**. Win-score = đủ **đạn thắng deal**. Consult gate (khi flag bật) bắt Win intel + Win ≥18. LLM chỉ **gợi ý** chấm, AM confirm. Không MEDDPICC brand. Không DDL.

---

## 1. Tóm tắt

Phase 1 đã tách “đủ Tư vấn” khỏi “đủ ký HĐ”. Phase 2 thêm lớp **thắng deal**:

| Lớp | Điểm | Ý nghĩa | Gate |
|-----|------|---------|------|
| BANT | `/30` · ngưỡng **24 / 18** (không đổi) | Đủ qualify → Tư vấn | Giữ rule hiện tại |
| Win | `/30` · ngưỡng **18** (consult) / **24** (gợi ý Proposal, không gate) | Đủ đạn incumbent / tiêu chí / rủi ro đổi | **Mới** — sau flag |

AM tick checklist Win (cùng pattern BANT). LLM (flag riêng, mặc định tắt) đọc Discovery + Win intel → gợi ý điểm kèm **quote**. Consult advance **block** nếu Go mà Win mỏng — không block Complete phiên.

**Pitch 1 câu:** Hết call — BANT nói “có nên Tư vấn không”; Win nói “đã biết cách thắng chưa”; máy gợi ý chấm, AM xác nhận, Funnel không cho nhảy Consult khi còn mù đối thủ.

---

## 2. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Win-score `/30` song song BANT | 6 key × 1–5; Deal Bar hiện `Win x/30`; persist `answers_json` |
| G2 | Bắt Win intel trước Consult | Flag ON: `decision=go` + thiếu 3 field bắt buộc hoặc Win &lt;18 → **block** advance |
| G3 | LLM gợi ý chấm | Flag ON: nút “Gợi ý chấm”; mỗi gợi ý có quote từ form; không ghi điểm nếu AM chưa confirm |
| G4 | Đổi gate có rollback | `PTT_INTAKE_WIN_GATE=0` = hành vi Phase 1; `=1` bật G2 |
| G5 | Không phá Phase 1 | `GO_THRESHOLDS` 24/18, 6 key `bant_json`, copy **Đủ Tư vấn**, Sales Kit chip `Còn thiếu để Go` |

### 2.1. In scope

- Checklist Win 6 mục + drawer Deal Bar **WIN**.
- `answers_json.win_checklist` + `answers_json.win_score_json`.
- Consult-gate đọc `answers_json` phiên completed mới nhất.
- Complete: **warn** Win mỏng (không error).
- `POST .../sessions/:id/suggest-scores` + UI confirm.
- Flag `PTT_INTAKE_WIN_GATE` + `PTT_INTAKE_LLM_SCORE` (default **0**).

### 2.2. Out of scope

- MEDDPICC / đổi tên tab.
- DDL / cột `win_score_total`.
- Đổi `GO_THRESHOLDS` BANT.
- Ép L2 docs / Proposal L1 trên funnel.
- Tự ghi `bant_json` / Win khi LLM trả lời (không confirm).
- Đổi 8 chip Sales Kit / kho admin.

---

## 3. Win-score

### 3.1. Sáu key

| Key | Tab nguồn | Bắt buộc Consult (Go) |
|-----|-----------|------------------------|
| `incumbent` | Win intel | **Có** |
| `competitor` | Win intel | Không (KH có thể chưa pitch song song) |
| `selection_criteria` | Win intel | **Có** |
| `switch_risk` | Win intel | **Có** |
| `champion` | Stakeholder / ghi chú Win | Không (điểm vẫn tính) |
| `next_step` | Commitments / Win | Không (điểm vẫn tính) |

`WIN_SCORE_KEYS` thứ tự tie-break: incumbent → competitor → selection_criteria → switch_risk → champion → next_step.

`WIN_THRESHOLDS = { consult: 18, proposal_hint: 24 }`.

### 3.2. Field “đủ” (coverage)

Một key **filled** khi:

1. `win_intel[key].answer.trim().length >= 8`, **và**
2. `confidence` ∈ `{ heard, confirmed }`  
   — hoặc (với `champion` / `next_step`) có điểm checklist 1–5 **và** không cần text Win intel.

Ba key bắt buộc Consult: `incumbent`, `selection_criteria`, `switch_risk`.

### 3.3. Checklist (1 dòng / mục, exclusive)

Cùng mechanic `toggleBantChecklistScore`: tick lại = 0.

Lưu: `answers_json.win_checklist` = `{ incumbent: 4, ... }` (chỉ key đã chấm).  
`answers_json.win_score_json` = 6 key 0–5 (máy derive, giống `bant_json`).

Không thêm cột PG. `computeWinTotal` thuần.

### 3.4. UI

- Deal Bar: nút **WIN** cạnh **BANT**; dòng `Win x/30 · Còn n để thắng` khi x &lt; 18, `Đủ đạn Tư vấn` khi ≥18. **Không** nói “Đủ chốt / Đủ HĐ”.
- Drawer `SalesCockpitDrawer` `kicker=WIN+` `title=Chấm Win` `testId=intake-win-drawer`.
- Tab Win intel: giữ 4 textarea; chip điểm nếu đã chấm.
- Qualify / Deal Bar BANT copy Phase 1 **không đổi**.

---

## 4. LLM gợi ý chấm

### 4.1. Flag & fail-closed

`PTT_INTAKE_LLM_SCORE` default **false**. Tắt → 503 `llm_score_disabled` hoặc UI ẩn nút.

Tái dùng `AiLlmClient.completeJson` + `ai_agent_runs` (use-case mới `INTAKE_SCORE_SUGGEST`). Không invent money (`assertNoInventedMoney`).

### 4.2. Contract

`POST /api/crm/intake/sessions/:id/suggest-scores`  
Cap: `crm_leads.edit`. Body: `{}`.

Response:

```ts
{
  stub_mode: boolean;
  suggestions: {
    bant?: Partial<Record<BantKey, { score: 1|2|3|4|5; quote: string }>>;
    win?: Partial<Record<WinScoreKey, { score: 1|2|3|4|5; quote: string }>>;
  };
  rejected: Array<{ layer: 'bant'|'win'; key: string; reason: 'empty_quote'|'quote_not_in_form' }>;
}
```

**Validate thuần (bắt buộc trước khi trả UI):**

- `quote.trim()` không rỗng.
- `normalize(quote)` là substring của `normalize(discoveryAnswers + winIntel answers + commitments)`.
- Không suggestion nếu form không có text cho nhóm đó.
- Không ghi session. AM bấm **Áp dụng gợi ý** → `toggle*ChecklistScore` từng key (chỉ key AM tick chọn; mặc định chọn key đang 0).

Khi LLM lỗi / timeout / stub: `suggestions={}`, `stub_mode=true`, không bịa điểm.

---

## 5. Đổi Consult gate

Hiện tại (`presales-consult-gate.util.ts`): Lead task ✓ · Intake completed · No-Go block · Nurture warn · Go + BANT&lt;24 warn · Go + BANT≥24 ok.

**Khi `PTT_INTAKE_WIN_GATE=0`:** không đổi 1 dòng.

**Khi `=1`**, sau các rule trên, nếu `decision === 'go'`:

| Điều kiện | Level |
|-----------|--------|
| Thiếu 1 trong 3 field bắt buộc | **block** — `Thiếu Win intel: {labels}. Ghi tab Win intel rồi mở WIN.` |
| `win_total < 18` | **block** — `Win {n}/30 dưới ngưỡng Tư vấn (18).` |
| `win_total >= 18` và 3 field đủ | giữ level BANT (ok hoặc warn BANT thấp) |

`buildConsultAdvanceGate` SELECT thêm `answers_json`.  
`IntakeSessionGateRow` thêm `answers_json?: Record<string, unknown>`.  
`win_total` = `computeWinTotal(scoreWinFromChecklist(parseWinChecklist(answers)))` trên phiên **completed** mới nhất (cùng session dùng `bant_total` hiện tại).

Complete phiên: thêm warn `win_thin` nếu `decision=go` và (thiếu required **hoặc** win_total&lt;18). **Không** error — Consult mới block.

`lifecycle-consult.util` `consultGateLevel` **không** đổi (lifecycle khác funnel). Chỉ `validatePresalesConsultAdvance`.

---

## 6. Copy AM

| Chỗ | Chuỗi |
|-----|--------|
| Deal Bar Win ≥18 | `Đủ đạn Tư vấn` |
| Deal Bar Win &lt;18 | `Còn {18-n} để thắng` |
| Gate block | không dùng “Đủ Go / chốt HĐ” |
| LLM | `Gợi ý chấm` · `Áp dụng gợi ý` · `Bỏ` |

---

## 7. UAT

| ID | Bước | Kỳ vọng |
|----|------|---------|
| U1 | Flag gate OFF, Go BANT 24, Win trống | Consult advance **ok** như Phase 1 |
| U2 | Flag gate ON, Go BANT 24, Win trống | Consult **block**, message Win intel |
| U3 | Điền 3 field + tick WIN đủ 18 | Consult ok (Lead task ✓) |
| U4 | LLM flag OFF | Không nút / 503 |
| U5 | LLM ON + stub | `suggestions={}`, không đổi điểm |
| U6 | LLM ON + quote giả | `rejected`, không apply |
| U7 | Complete Go + Win mỏng | Warn, vẫn Complete được |

e2e Task 8 (`intake-win-score-phase2.spec.ts`): Deal Bar **WIN** + copy **Đủ Tư vấn**; tick incumbent 4 → `Win 4–9`; live Consult-gate **skip** nếu `PTT_INTAKE_WIN_GATE` ≠ `1` (health không expose flag). U1–U3 gate unit: Task 4. **Không tick U4–U7** — LLM / flag prod tắt.

---

## 8. Tiêu chí xong

- [x] Win `/30` persist + Deal Bar + drawer.
- [x] Gate OFF = Phase 1; ON = block Go thiếu Win.
- [x] LLM không ghi điểm không confirm; quote phải nằm trong form.
- [x] BANT 24/18 + schema 6 key không đổi.
- [x] Unit gate + suggest-validate + Complete warn; e2e U1–U3 (U4–U6 nếu API LLM).

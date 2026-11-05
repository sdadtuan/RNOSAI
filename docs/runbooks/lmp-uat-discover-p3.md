# LMP Discover Phase 3 — UAT 10 lead Meta (chỉ SĐT/email)

> **Mục tiêu:** Xác nhận luồng Discover Identity trước GA (DISC-01…06).  
> **Prerequisite:** Phase 0–2 deployed, `LMP_IDENTITY_DISCOVER_ENABLED=1`, `LMP_DISCOVER_CACHE_ENABLED=1`, Tavily key prod.

---

## 1. Chuẩn bị

| Việc | Ai |
|------|-----|
| 2 AM pilot + 1 GDKD | Ops |
| 10 lead Meta thật **chỉ SĐT** (hoặc SĐT + email cá nhân) | AM / QA |
| Quyền `crm_lmp.view`, `crm_lmp.run`, `crm_kpi_records.view` | Ops |
| Gate kỹ thuật | Eng |

```bash
bash scripts/lmp_discover_gate.sh
bash scripts/lead_meeting_prep_gate.sh
```

**Dashboard KPI:** `/crm/ai/insights?tab=sci` → section **Discover Identity · KPI**

---

## 2. Ma trận 10 lead

| # | Input lead | Kỳ vọng discover | AM action | Pass |
|---|------------|------------------|-----------|------|
| 1 | SĐT VN có masothue | `found_single` → auto prep | Không | ☐ |
| 2 | SĐT trùng 2+ DN | `found_multiple` | Chọn DN đúng | ☐ |
| 3 | SĐT Gmail cá nhân | `not_found` | Nhập công ty | ☐ |
| 4 | Email `@congty.vn` | `tier1_only` hoặc hit | Xác nhận gợi ý | ☐ |
| 5 | Lead #1 lặp SĐT (cache) | Cache hit, 0 Tavily mới | Không | ☐ |
| 6 | Thiếu cả SĐT lẫn email | `skipped` | Bổ sung contact | ☐ |
| 7 | AM nhập sai DN → sửa | Write-back `am_manual` | Lưu & chạy prep | ☐ |
| 8 | Chọn entity picker | `am_confirmed` trên lead | Xác nhận & tiếp tục | ☐ |
| 9 | Prep ready ≤5 phút p95 | SCI hiển thị | Gọi thử M1 script | ☐ |
| 10 | Debrief sau chot/lost | `discover_source` trong win_outcome | Gửi debrief | ☐ |

---

## 3. Tiêu chí GA (pilot)

| ID | Target |
|----|--------|
| DISC-01 | 100% lead có contact enqueue được (không skip thiếu công ty) |
| DISC-02 | Hit rate ≥ 50% |
| DISC-03 | Time-to-ready p95 ≤ 5 phút (có hit) |
| DISC-04 | AM override ≤ 40% |
| DISC-05 | 0 fact sai pháp nhân block UAT |
| DISC-06 | Audit log không query SĐT → Facebook cá nhân |

---

## 4. Sign-off

| Vai trò | Tên | Ngày | OK |
|---------|-----|------|-----|
| AM pilot | | | ☐ |
| GDKD | | | ☐ |
| Eng | | | ☐ |

Ghi chú blocker:

```
```

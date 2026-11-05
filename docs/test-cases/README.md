# RNOSAI — Bộ Test Case (2026-09-17)

Bộ tài liệu UAT / regression cho **ops-web + CRM API**, chia theo 3 góc nhìn.

| # | File | Mục đích | Quy mô |
|---|------|----------|--------|
| 1 | [2026-09-17-rnosai-tc-theo-chuc-vu-va-luong.md](./2026-09-17-rnosai-tc-theo-chuc-vu-va-luong.md) | Test theo **chức vụ** và **luồng nghiệp vụ** | ~75 TC · SUPER-ADMIN → CSKH-01 |
| 2 | [2026-09-17-rnosai-tc-tong-the-he-thong.md](./2026-09-17-rnosai-tc-tong-the-he-thong.md) | Test **tổng thể hệ thống** (smoke, auth, RBAC, deploy, QA) | ~87 TC |
| 3 | [2026-09-17-rnosai-tc-theo-man-hinh.md](./2026-09-17-rnosai-tc-theo-man-hinh.md) | Test theo **từng màn hình / route** | ~207 TC chi tiết + inventory ~364 routes |

## Cách dùng nhanh

1. **Trước release:** file (2) mục Smoke P0 + Deploy.  
2. **UAT theo role bàn giao:** file (1) đúng chức vụ.  
3. **UAT module / màn đổi trong PR:** file (3) mục tương ứng + COMMON checklist.

## Tham chiếu

- Ma trận quyền: `docs/exports/ma-tran-phan-quyen-RNOSAI-ban-giao-2026-09-16.md`
- Legacy PTT: `docs/TEST_CASES_PTT.md`
- Hướng dẫn tester: `docs/crm/bo-test-case-huong-dan-tester.md`

**App:** `https://rs.pttads.vn` · **Document date:** 2026-09-17

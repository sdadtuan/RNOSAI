import { describe, expect, it } from 'vitest';
import {
  APPROVALS_EMPTY,
  ESCALATE_TOAST,
  OPEN_PORTAL_TOAST,
  approvalReviewHref,
} from './cmkte-approvals';

describe('approvalReviewHref', () => {
  it('opens workspace tab 7 via approvaltab query', () => {
    expect(approvalReviewHref(21)).toBe('/crm/content-os/w/21?tab=approvaltab');
  });
});

describe('approval copy', () => {
  it('locks escalate, portal, and empty toasts from the spec', () => {
    expect(ESCALATE_TOAST).toBe('Đã chuyển escalate. Legal/AM sẽ thấy trên queue.');
    expect(OPEN_PORTAL_TOAST).toBe('Đã mở cổng duyệt client. Không gửi ghi chú nội bộ.');
    expect(APPROVALS_EMPTY).toBe('Chưa có item chờ duyệt trong phạm vi của bạn.');
  });
});

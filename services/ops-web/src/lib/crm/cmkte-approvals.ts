export const ESCALATE_TOAST = 'Đã chuyển escalate. Legal/AM sẽ thấy trên queue.';
export const OPEN_PORTAL_TOAST = 'Đã mở cổng duyệt client. Không gửi ghi chú nội bộ.';
export const APPROVALS_EMPTY = 'Chưa có item chờ duyệt trong phạm vi của bạn.';
export const BATCH_APPROVE_MAX = 20;

export function approvalReviewHref(itemId: number): string {
  return `/crm/content-os/w/${itemId}?tab=approvaltab`;
}

export function canBatchApprove(ids: number[]): boolean {
  return ids.length > 0 && ids.length <= BATCH_APPROVE_MAX;
}

export type LmpSkipReason =
  | 'missing_company_name'
  | 'missing_contact'
  | 'duplicate_lead'
  | 'spa_operational'
  | 'pilot_client_mismatch';

const SKIP_REASON_MESSAGE_VI: Record<string, string> = {
  missing_company_name:
    'Lead có SĐT/email nhưng thiếu tên công ty. Vui lòng nhập tên công ty (và website nếu có) để hệ thống tìm và chuẩn bị cuộc hẹn.',
  missing_contact:
    'Lead thiếu cả số điện thoại lẫn email — không thể chạy prep. Bổ sung liên hệ rồi thử lại.',
  duplicate_lead: 'Lead trùng — prep không chạy tự động.',
  spa_operational: 'Lead vận hành spa — không thuộc phạm vi Sales Cockpit.',
  pilot_client_mismatch: 'Lead không thuộc client pilot LMP.',
};

const STATUS_MESSAGE_VI: Record<string, string> = {
  awaiting_am_input: 'Chờ AM bổ sung thông tin công ty',
  skipped: 'Prep bỏ qua',
  pending: 'Đang xếp hàng',
  running: 'Đang xử lý',
  awaiting_entity_choice: 'Cần chọn doanh nghiệp',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
  cancelled: 'Đã hủy',
};

export function lmpSkipReasonMessageVi(reason: string | null | undefined): string {
  if (!reason) return 'Prep bỏ qua — bổ sung thông tin rồi chạy lại.';
  return SKIP_REASON_MESSAGE_VI[reason] ?? `Prep bỏ qua (${reason}).`;
}

export function lmpStatusMessageVi(
  status: string,
  skipReason?: string | null,
): string {
  if (status === 'awaiting_am_input') {
    return lmpSkipReasonMessageVi(skipReason ?? 'missing_company_name');
  }
  if (status === 'skipped') {
    return lmpSkipReasonMessageVi(skipReason);
  }
  return STATUS_MESSAGE_VI[status] ?? status;
}

export function lmpStatusLabelVi(status: string): string {
  if (status === 'awaiting_am_input') return 'Chờ AM bổ sung';
  return STATUS_MESSAGE_VI[status] ?? status;
}

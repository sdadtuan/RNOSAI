const SKIP_REASON_MESSAGE_VI: Record<string, string> = {
  missing_company_name:
    'Lead có SĐT/email nhưng thiếu tên công ty. Nhập tên công ty (và website nếu có) để hệ thống tìm và chuẩn bị cuộc hẹn.',
  missing_contact:
    'Lead thiếu cả số điện thoại lẫn email — không thể chạy prep. Bổ sung liên hệ rồi thử lại.',
  duplicate_lead: 'Lead trùng — prep không chạy tự động.',
  spa_operational: 'Lead vận hành spa — không thuộc phạm vi Sales Cockpit.',
  pilot_client_mismatch: 'Lead không thuộc client pilot LMP.',
};

export function lmpSkipReasonMessageVi(reason: string | null | undefined): string {
  if (!reason) return 'Prep bỏ qua — bổ sung thông tin rồi chạy lại.';
  return SKIP_REASON_MESSAGE_VI[reason] ?? `Prep bỏ qua (${reason}).`;
}

export function showAmInputForm(status: string, skipReason?: string | null): boolean {
  if (status === 'awaiting_am_input') {
    return skipReason !== 'discover_multiple';
  }
  return status === 'skipped' && skipReason === 'missing_company_name';
}

export function showDiscoverEntityPicker(status: string, candidateCount: number): boolean {
  if (candidateCount <= 0) return false;
  return status === 'awaiting_entity_choice' || status === 'awaiting_am_input';
}

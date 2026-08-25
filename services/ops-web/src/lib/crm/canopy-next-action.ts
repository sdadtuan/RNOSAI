/** P2 — one next-action line per workspace path (Pipedrive-style). */
export function nextActionFor(pathname: string): string | null {
  const path = String(pathname ?? '').split('?')[0] || '/';

  if (path === '/crm/b2b/leads' || path === '/crm/leads') {
    return 'Bước tiếp: gọi lead Nóng trong giờ làm việc — mở card hoặc Inbox.';
  }
  if (path.startsWith('/crm/b2b/leads/new') || path.startsWith('/crm/leads/new')) {
    return 'Bước tiếp: chọn Dự án PTT, lưu lead, rồi gọi trong 15 phút.';
  }
  if (path.startsWith('/crm/leads/') && path !== '/crm/leads') {
    return 'Bước tiếp: Intake BANT hoặc chuyển giai đoạn trên funnel — một CTA xanh.';
  }
  if (path.startsWith('/crm/b2b-inbox')) {
    return 'Bước tiếp: mở thread Nóng, trả lời, rồi cập nhật trạng thái lead.';
  }
  if (path.startsWith('/crm/intake')) {
    return 'Bước tiếp: Discovery → BANT → Red flags → Hoàn thành (Go ≥ 24).';
  }
  if (path.startsWith('/crm/proposals') || path.startsWith('/crm/solution')) {
    return 'Bước tiếp: đủ L2 + Consult rồi soạn đề xuất / báo giá.';
  }
  if (path.startsWith('/crm/hub')) {
    return 'Bước tiếp: HĐ draft → Active khi đã ký — mới tạo KH agency.';
  }
  if (path.startsWith('/crm/sales')) {
    return 'Bước tiếp: chọn deal trên kanban, một việc tiếp theo trên card.';
  }
  if (path.startsWith('/crm/b2b-projects')) {
    return 'Bước tiếp: map kênh ingest + bật Nhận lead trước khi nhận webhook.';
  }
  if (path.startsWith('/crm/b2b-unmatched')) {
    return 'Bước tiếp: gắn form/OA chưa map vào Dự án PTT — chưa map thì không có lead.';
  }
  if (path.startsWith('/crm/b2b-speed') || path.startsWith('/crm/b2b-gdkd')) {
    return 'Bước tiếp: xem p95 phản hồi và lead SLA — phân lại pool nếu chậm.';
  }
  if (path.startsWith('/crm/operational/leads')) {
    return 'Bước tiếp: liên hệ lead Meta trong 24h — SOP CSKH vận hành.';
  }
  if (path === '/login' || path.startsWith('/login/')) {
    return null;
  }
  return null;
}

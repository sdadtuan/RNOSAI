import type { LeadPageNextHint } from '@/lib/crm/lead-page-next-hint';

/** Sale work that sits above Solution. Marketing Leader does not see these prompts. */
function isSaleEarlyPath(path: string): boolean {
  return (
    path === '/crm/b2b/leads' ||
    path === '/crm/leads' ||
    path.startsWith('/crm/b2b/leads/new') ||
    path.startsWith('/crm/leads/new') ||
    (path.startsWith('/crm/leads/') && path !== '/crm/leads') ||
    path.startsWith('/crm/b2b-inbox') ||
    path.startsWith('/crm/intake') ||
    path.startsWith('/crm/sales') ||
    path.startsWith('/crm/operational/leads')
  );
}


function normalize(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Stage-aware line for the lead-detail chrome banner. */
export function nextActionForLeadDetail(hint: LeadPageNextHint | null | undefined): string {
  const phase = normalize(hint?.quotePhase);
  const handoff = normalize(hint?.handoffStatus);
  const stage = normalize(hint?.presalesStage);
  const viewer = hint?.viewer ?? 'other';
  const isAm = viewer === 'am' || viewer === 'admin';
  const isCeo = viewer === 'ceo' || viewer === 'admin';
  const isSales = viewer === 'sales';

  if (phase === 'trien_khai') {
    return 'Bước tiếp: lead đã sang Triển khai.';
  }
  if (phase === 'hop_dong') {
    return isSales
      ? 'Bước tiếp: xem và tải báo giá đã duyệt; gửi hợp đồng cho GĐKD duyệt.'
      : 'Bước tiếp: báo giá đã được CEO duyệt — Sales có thể xem và tải.';
  }
  if (phase === 'ceo_review' || phase === 'sale_review') {
    return isCeo
      ? 'Bước tiếp: duyệt hoặc từ chối báo giá (kèm lý do nếu từ chối).'
      : 'Bước tiếp: chờ CEO duyệt báo giá.';
  }
  if (phase === 'bao_gia' || phase === 'chuyen_bao_gia') {
    if (hint?.quoteRejected && isAm) {
      return 'Bước tiếp: chỉnh báo giá theo lý do CEO từ chối, rồi gửi lại.';
    }
    return isAm
      ? 'Bước tiếp: hoàn thiện bảng báo giá rồi gửi CEO duyệt.'
      : 'Bước tiếp: chờ AM lập báo giá (hạn 2 giờ làm việc).';
  }
  if (handoff === 'released' || stage === 'proposal') {
    return isAm
      ? 'Bước tiếp: khách đã đồng ý — lập báo giá trong 2 giờ làm việc.'
      : 'Bước tiếp: khách đã đồng ý — chờ AM lập báo giá.';
  }
  const hasRevision = Boolean(String(hint?.revisionNote ?? '').trim());
  const returned =
    handoff === 'returned' ||
    handoff === 'returned_to_sales' ||
    handoff === 'return' ||
    (hasRevision &&
      phase !== 'trien_khai' &&
      phase !== 'hop_dong' &&
      phase !== 'ceo_review' &&
      phase !== 'sale_review' &&
      phase !== 'bao_gia' &&
      phase !== 'chuyen_bao_gia' &&
      handoff !== 'with_solution' &&
      handoff !== 'released' &&
      handoff !== 'pending');
  if (returned) {
    const reason = String(hint?.revisionNote ?? '').trim();
    return reason
      ? `Bước tiếp: Solutions đã trả lại case — bổ sung thông tin theo lý do: ${reason}. Rồi gửi lại.`
      : 'Bước tiếp: Solutions đã trả lại case — bổ sung thông tin theo yêu cầu, rồi gửi lại.';
  }
  if (handoff === 'with_solution') {
    return isAm
      ? 'Bước tiếp: hoàn thiện Solution và trả về Sales trong hạn làm việc.'
      : 'Bước tiếp: Solutions đang xử lý case — bạn chỉ xem.';
  }
  if (handoff === 'pending') {
    return isAm
      ? 'Bước tiếp: nhận case Solutions trên hàng chờ.'
      : 'Bước tiếp: đã gửi SUBMIT FOR SOLUTION — chờ Solutions nhận case.';
  }
  if (hint?.b2Complete) {
    if (stage === 'consult' || stage === 'lead') {
      return 'Bước tiếp: hoàn thành khảo sát BANT, rồi bấm SUBMIT FOR SOLUTION.';
    }
    return 'Bước tiếp: hoàn thành khảo sát BANT, rồi bấm SUBMIT FOR SOLUTION.';
  }
  if (hint?.claimed) {
    return 'Bước tiếp: liên hệ khách và hoàn thành bước Liên hệ lần đầu (B2).';
  }
  return 'Bước tiếp: nhận lead trong 15 phút.';
}


/** P2 — one next-action line per workspace path (Pipedrive-style). */
export function nextActionFor(
  pathname: string,
  options?: { hideSaleEarly?: boolean; leadHint?: LeadPageNextHint | null },
): string | null {
  const path = String(pathname ?? '').split('?')[0] || '/';
  if (options?.hideSaleEarly && isSaleEarlyPath(path)) {
    if (path.startsWith('/crm/leads/') && path !== '/crm/leads' && options?.leadHint) {
      return nextActionForLeadDetail(options.leadHint);
    }
    return null;
  }

  if (path === '/crm/b2b/leads' || path === '/crm/leads') {
    return 'Bước tiếp: gọi lead Nóng trong giờ làm việc — mở card hoặc Inbox.';
  }
  if (path.startsWith('/crm/b2b/leads/new') || path.startsWith('/crm/leads/new')) {
    return 'Bước tiếp: chọn Dự án PTT, lưu lead, rồi gọi trong 15 phút.';
  }
  if (path.startsWith('/crm/leads/') && path !== '/crm/leads') {
    if (options?.leadHint) return nextActionForLeadDetail(options.leadHint);
    return 'Bước tiếp: hoàn thành khảo sát BANT, rồi bấm SUBMIT FOR SOLUTION.';
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

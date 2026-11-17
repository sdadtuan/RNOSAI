/** Map raw CRM API error codes to short Vietnamese messages. Never surface codes. */

const GENERIC_HTTP = new Set([
  'Forbidden',
  'Unauthorized',
  'Bad Request',
  'Not Found',
  'Internal Server Error',
  'ForbiddenException',
  'UnauthorizedException',
  'BadRequestException',
  'Forbidden resource',
  'Internal server error',
  'Internal Server Error Exception',
]);

const CRM_API_ERROR_VI: Record<string, string> = {
  missing_cap: 'Bạn chưa được cấp quyền thực hiện thao tác này.',
  solution_read_only: 'Bạn không thể chỉnh hồ sơ này ở bước hiện tại.',
  solution_release_required: 'Cần nộp Solution cho Sales trước khi chuyển bước.',
  client_brief_incomplete: 'Hồ sơ khách chưa đủ thông tin để tạo Solution bằng AI.',
  ai_not_configured: 'Chưa cấu hình AI',
  invalid_signature: 'Chữ ký không hợp lệ',
  llm_timeout: 'AI hết thời gian chờ. Vui lòng thử lại.',
  llm_provider_error: 'Không gọi được AI. Vui lòng thử lại.',
  solution_agent_unavailable: 'Không gửi được yêu cầu tới agent AI',
  Unauthorized: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  unauthorized: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  Forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  not_solution_assignee:
    'Chỉ người được giao làm Solution của lead này (hoặc SUPER-ADMIN) mới được dùng chức năng này.',
  review_queue_active: 'Lead đang ở danh mục Phải tra soát — chỉ GDKD được xử lý.',
  policy_denied: 'Lead chưa đủ điều kiện cho bước này (chính sách pre-sales).',
  policy_service_unavailable: 'Hệ thống kiểm tra quyền đang tạm lỗi. Vui lòng thử lại sau.',
  session_revoked: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  token_revoked: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  'Invalid or expired token': 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  chat_scope_forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  invalid_lead_id: 'Mã lead không hợp lệ.',
  lead_not_found: 'Không tìm thấy lead.',
  lead_locked: 'Lead đã khóa (Sai số) — chỉ Super Admin được chỉnh sửa hoặc chuyển lead này.',
  lead_hidden: 'Lead đã ẩn — chỉ Super Admin được xem hoặc chỉnh lead này.',
  am_cannot_claim_lead: 'Vai trò AM không nhận lead. Sales bấm Nhận lead.',
  note_required: 'Ghi chú Ẩn lead cần từ 3 đến 500 ký tự.',
};

/** A server sentence worth showing as-is (not an HTTP default and not a snake_case code). */
function isReadableMessage(value: string): boolean {
  return Boolean(value) && !GENERIC_HTTP.has(value) && !looksLikeCode(value);
}

const CLIENT_BRIEF_INCOMPLETE = 'client_brief_incomplete';
const CLIENT_BRIEF_INCOMPLETE_VI = CRM_API_ERROR_VI[CLIENT_BRIEF_INCOMPLETE];

function looksLikeCode(value: string): boolean {
  return /^[a-z][a-z0-9_]{2,}$/i.test(value) && !value.includes(' ');
}

function uniqueFields(parts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const text = part.replace(/\.$/, '').trim();
    if (!text || looksLikeCode(text) || GENERIC_HTTP.has(text)) continue;
    if (text === CLIENT_BRIEF_INCOMPLETE_VI) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** Parse the API field list ("Điểm khác biệt; Ngành KH") into a display string. */
export function formatClientBriefMissingFields(
  message?: string | null,
  details?: string[] | string | null,
): string {
  const fromDetails = Array.isArray(details)
    ? details.map((item) => String(item ?? '').trim())
    : String(details ?? '').trim()
      ? [String(details).trim()]
      : [];
  const fromMessage = String(message ?? '')
    .split(/;|\n/)
    .map((item) => item.trim());
  return uniqueFields([...fromDetails, ...fromMessage]).join(', ');
}

function isClientBriefIncomplete(error?: string | null, message?: string | null): boolean {
  const err = String(error ?? '').trim();
  const msg = String(message ?? '').trim();
  return err === CLIENT_BRIEF_INCOMPLETE || msg === CLIENT_BRIEF_INCOMPLETE;
}

export function humanizeCrmApiError(
  error?: string | null,
  message?: string | null,
  details?: string[] | string | null,
  reason?: string | null,
): string {
  const err = String(error ?? '').trim();
  const msg = String(message ?? '').trim();
  const why = String(reason ?? '').trim();
  if (isClientBriefIncomplete(err, msg)) {
    const fields = formatClientBriefMissingFields(msg, details);
    const base = CLIENT_BRIEF_INCOMPLETE_VI.replace(/\.$/, '');
    return fields ? `${base}. Thiếu: ${fields}.` : `${base}.`;
  }
  // Prefer the API's own sentence (e.g. "Chỉ AM phụ trách…") over a generic mapped code.
  const mapped =
    (isReadableMessage(msg) && !CRM_API_ERROR_VI[msg] ? msg : '') ||
    (why && CRM_API_ERROR_VI[why]) ||
    (err && CRM_API_ERROR_VI[err]) ||
    (msg && CRM_API_ERROR_VI[msg]) ||
    '';
  let out = mapped;
  if (!out) {
    if (msg && !GENERIC_HTTP.has(msg) && !looksLikeCode(msg)) out = msg;
    else if (err && !GENERIC_HTTP.has(err) && !looksLikeCode(err)) out = err;
    else if (looksLikeCode(err) || looksLikeCode(msg)) {
      out = 'Thao tác thất bại. Vui lòng thử lại hoặc liên hệ quản trị.';
    } else {
      out = msg || err || 'Thao tác thất bại.';
    }
  }
  return out.replace(/\bmissing_cap\b/gi, 'không đủ quyền').trim();
}

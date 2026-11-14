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
]);

const CRM_API_ERROR_VI: Record<string, string> = {
  missing_cap: 'Bạn chưa được cấp quyền thực hiện thao tác này.',
  solution_read_only: 'Bạn không thể chỉnh hồ sơ này ở bước hiện tại.',
  solution_release_required: 'Cần nộp Solution cho Sales trước khi chuyển bước.',
  client_brief_incomplete: 'Hồ sơ khách chưa đủ thông tin để tạo Solution bằng AI.',
  Unauthorized: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  unauthorized: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  Forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
};

function looksLikeCode(value: string): boolean {
  return /^[a-z][a-z0-9_]{2,}$/i.test(value) && !value.includes(' ');
}

export function humanizeCrmApiError(error?: string | null, message?: string | null): string {
  const err = String(error ?? '').trim();
  const msg = String(message ?? '').trim();
  const mapped =
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

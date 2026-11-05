/** Column order for PermissionMatrixTable — includes catalog extra_actions used by CEO / GDKD / leads. */
export const PERMISSION_MATRIX_ACTIONS = [
  'view',
  'edit',
  'create',
  'delete',
  'export',
  'configure',
  'act',
  'approve',
  'claim',
  'release',
  'write',
  'settings',
  'compliance',
  'deliverability',
  'reports',
  'assign',
  'view_all',
  'manage',
  'override',
  'review_queue',
  'view_all_leads',
  'view_financial',
  'view_pii',
  'generate',
  'publish',
  'approve_internal',
  'qa',
  'production',
  'admin',
  'execute',
  'view_team',
  'finance_request',
  'request',
  'send',
  'query',
  'commit',
  'review',
  'lists',
  'schedule',
  'executive',
  'bcc',
  'external',
  'simulate',
  'org',
  'rbac',
  'audit',
  'policy',
  'run',
  'feedback',
  'submit',
] as const;

export type PermissionMatrixAction = (typeof PERMISSION_MATRIX_ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: 'Xem',
  edit: 'Sửa',
  create: 'Tạo',
  delete: 'Xóa',
  export: 'Xuất',
  configure: 'Cấu hình',
  act: 'Điều hành (Xác nhận)',
  approve: 'Duyệt',
  claim: 'Nhận case',
  release: 'Trả Sales',
  write: 'Ghi / thao tác',
  settings: 'Cài đặt',
  compliance: 'Tuân thủ',
  deliverability: 'Deliverability',
  reports: 'Báo cáo',
  assign: 'Phân công (GDKD)',
  view_all: 'Xem tất cả',
  manage: 'Quản lý',
  override: 'Override GDKD',
  review_queue: 'Review queue',
  view_all_leads: 'Xem toàn bộ lead',
  view_financial: 'Xem giá trị tài chính lead',
  view_pii: 'Xem PII (SĐT/email)',
  generate: 'Sinh nội dung AI',
  publish: 'Xuất bản',
  approve_internal: 'Duyệt nội bộ',
  qa: 'QA / Legal',
  production: 'Sản xuất / asset',
  admin: 'Admin Content OS',
  execute: 'Thực thi',
  view_team: 'Xem team',
  finance_request: 'Yêu cầu finance',
  request: 'Tự gửi / yêu cầu',
  send: 'Gửi',
  query: 'Truy vấn NL',
  commit: 'Cam kết forecast',
  review: 'Review BC',
  lists: 'DS phân phối',
  schedule: 'Lịch BC',
  executive: 'Executive BC',
  bcc: 'BCC BC',
  external: 'BC external',
  simulate: 'Simulate workflow',
  org: 'Phạm vi org',
  rbac: 'Phạm vi RBAC',
  audit: 'Phạm vi audit',
  policy: 'Phạm vi policy',
  run: 'Chạy job (desk/deep)',
  feedback: 'Phản hồi LMP',
  submit: 'Gửi / submit ops',
};

export function permissionActionLabel(action: string): string {
  return PERMISSION_ACTION_LABELS[action] ?? action;
}

export function computeGrantDiff(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  const sections = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const section of sections) {
    const prev = new Set(before[section] ?? []);
    const next = new Set(after[section] ?? []);
    for (const action of next) {
      if (!prev.has(action)) added += 1;
    }
    for (const action of prev) {
      if (!next.has(action)) removed += 1;
    }
  }
  return { added, removed };
}

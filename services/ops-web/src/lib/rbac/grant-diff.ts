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
  'run',
  'feedback',
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
  run: 'Chạy job (desk/deep)',
  feedback: 'Phản hồi LMP',
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

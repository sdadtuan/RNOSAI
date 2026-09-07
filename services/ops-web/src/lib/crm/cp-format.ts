export const KPI_TILES = [
  {
    key: 'videos_created',
    label: 'Video đã tạo',
    href: '/crm/creative-os/video?created=1',
  },
  {
    key: 'videos_approved',
    label: 'Video đã duyệt',
    href: '/crm/creative-os/video?approval=final',
  },
  {
    key: 'render_success_rate',
    label: 'Render thành công',
    href: '/crm/creative-os/ops?result=completed',
  },
  {
    key: 'render_avg_duration_sec',
    label: 'Thời lượng render TB',
    href: '/crm/creative-os/ops',
  },
  {
    key: 'credits_used',
    label: 'Credit đã dùng',
    href: '/crm/creative-os/reports?tab=credit',
  },
  {
    key: 'credits_remaining',
    label: 'Credit còn lại',
    href: '/crm/creative-os/projects',
  },
  {
    key: 'assets_expiring',
    label: 'Asset sắp hết quyền',
    href: '/crm/creative-os/media?tab=rights',
  },
  {
    key: 'tasks_overdue',
    label: 'Việc quá hạn',
    href: '/crm/creative-os/projects?tab=tasks',
  },
] as const;

export type CpKpiKey = (typeof KPI_TILES)[number]['key'];

export type CpTrendPoint = {
  created: number | null;
  approved: number | null;
  published: number | null;
};

export function dash(value: unknown): string {
  return value == null ? '—' : String(value);
}

export function hasTrendData(points: CpTrendPoint[]): boolean {
  return points.some((point) =>
    [point.created, point.approved, point.published].some((value) => value != null),
  );
}

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

export function normalizeCpHref(href: string): string {
  const [path, query] = href.split('?');
  const suffix = query ? `?${query}` : '';
  const existingVideoReview = path.match(
    /^\/crm\/creative-os\/video\/([^/]+)\/review$/,
  );
  if (existingVideoReview) {
    return `/crm/creative-os/video/${existingVideoReview[1]}${suffix}`;
  }
  if (path.startsWith('/crm/creative-os')) return href;

  const version = path.match(/^\/cp\/(?:video-versions|videos\/versions)\/([^/]+)(?:\/review)?$/);
  if (version) {
    return `/crm/creative-os/video/versions/${version[1]}${suffix}`;
  }
  const video = path.match(/^\/cp\/videos\/([^/]+)(?:\/review)?$/);
  if (video) {
    return `/crm/creative-os/video/${video[1]}${suffix}`;
  }
  const render = path.match(/^\/cp\/renders\/([^/]+)$/);
  if (render) {
    return `/crm/creative-os/video/ops?job=${encodeURIComponent(render[1])}`;
  }
  const asset = path.match(/^\/cp\/assets\/([^/]+)$/);
  if (asset) {
    return `/crm/creative-os/media/${asset[1]}${suffix}`;
  }
  if (path === '/cp/activity') return `/crm/creative-os/activity${suffix}`;
  if (path === '/cp/credits') return `/crm/creative-os/reports${suffix}`;
  return '/crm/creative-os';
}

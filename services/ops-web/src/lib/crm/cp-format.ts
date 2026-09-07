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

export const MISSING_INGEST_COPY = 'Thiếu nguồn';

export const CP_REPORT_TABS = [
  { slug: 'executive', label: 'Điều hành' },
  { slug: 'production', label: 'Sản xuất' },
  { slug: 'credit', label: 'Credit' },
  { slug: 'performance', label: 'Hiệu quả' },
  { slug: 'governance', label: 'Quản trị' },
] as const;

export const CP_REPORT_FILTERS = ['from', 'to', 'client'] as const;

export const CP_REPORT_SECTIONS = {
  executive: ['trend', 'top_creative', 'project_health'],
  production: ['heatmap', 'provider_health'],
  credit: ['by_pipeline'],
} as const;

export type CpReportSlug = (typeof CP_REPORT_TABS)[number]['slug'];

export type CpSourcedMetric = {
  value: number | null;
  source: string;
  freshness: string | null;
};

export function dash(value: unknown): string {
  return value == null ? '—' : String(value);
}

export function formatOpsSlots(used: number | null, max: number | null): string {
  return `${dash(used)} / ${dash(max)}`;
}

export function formatOpsP95(p95Sec: number | null): string {
  return p95Sec == null ? dash(null) : `${Math.round(p95Sec)}s`;
}

export function sourcedDisplay(metric: CpSourcedMetric | null | undefined): {
  value: string;
  missing: boolean;
} {
  if (metric == null || metric.value == null) {
    return { value: '—', missing: true };
  }
  return { value: String(metric.value), missing: false };
}

export function hasTrendData(points: CpTrendPoint[]): boolean {
  return points.some((point) =>
    [point.created, point.approved, point.published].some((value) => value != null),
  );
}

export function rightsStatus(
  expiry: string | Date | null | undefined,
  today: string | Date = vietnamToday(),
): 'ok' | 'warn' | 'block' | null {
  const expiryDate = calendarDate(expiry);
  if (!expiryDate) return null;
  const todayDate = calendarDate(today);
  if (!todayDate) throw new Error('invalid_today');
  if (expiryDate < todayDate) return 'block';
  return expiryDate <= addCalendarDays(todayDate, 14) ? 'warn' : 'ok';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function calendarDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new Error('invalid_date');
  return calendarDate(parsed);
}

function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
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

export type RawLeadListQuery = {
  page: number;
  page_size: number;
  status?: string[];
  readiness_status?: string;
  priority_tier?: string;
  job_id?: number;
  q?: string;
  has_phone?: boolean;
  has_contact?: boolean;
  include_auto_rejected: boolean;
};

function truthyFlag(raw: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(raw ?? '').trim().toLowerCase());
}

export function totalPages(total: number, pageSize: number): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const ps = Math.max(1, Math.floor(Number(pageSize) || 1));
  if (t === 0) return 0;
  return Math.ceil(t / ps);
}

export function offsetForPage(page: number, pageSize: number): number {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const ps = Math.max(1, Math.floor(Number(pageSize) || 1));
  return (p - 1) * ps;
}

export function parseRawLeadListQuery(
  input: Record<string, string | undefined>,
): RawLeadListQuery {
  let page = Math.floor(Number(input.page ?? 1));
  if (!Number.isFinite(page) || page < 1) page = 1;

  let pageSize = Math.floor(Number(input.page_size ?? 50));
  if (!Number.isFinite(pageSize)) pageSize = 50;
  pageSize = Math.min(100, Math.max(10, pageSize));

  const statusRaw = String(input.status ?? '').trim();
  const status = statusRaw
    ? statusRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const jobIdNum = Number(input.job_id);
  const job_id =
    Number.isFinite(jobIdNum) && jobIdNum > 0 ? Math.floor(jobIdNum) : undefined;

  const q = String(input.q ?? '').trim() || undefined;

  const readinessRaw = String(input.readiness_status ?? '').trim().toUpperCase();
  const readinessAllowed = new Set([
    'READY_TO_PUSH',
    'NEEDS_REVIEW',
    'MISSING_CONTACT',
    'DUPLICATE_OR_BLACKLIST',
  ]);
  const readiness_status =
    readinessRaw && readinessAllowed.has(readinessRaw) ? readinessRaw : undefined;

  const priorityRaw = String(input.priority_tier ?? '').trim().toUpperCase();
  const priorityAllowed = new Set(['P1', 'P2', 'P3']);
  const priority_tier =
    priorityRaw && priorityAllowed.has(priorityRaw) ? priorityRaw : undefined;

  return {
    page,
    page_size: pageSize,
    status: status?.length ? status : undefined,
    readiness_status,
    priority_tier,
    job_id,
    q,
    has_phone: truthyFlag(input.has_phone) ? true : undefined,
    has_contact: truthyFlag(input.has_contact) ? true : undefined,
    include_auto_rejected: truthyFlag(input.include_auto_rejected),
  };
}

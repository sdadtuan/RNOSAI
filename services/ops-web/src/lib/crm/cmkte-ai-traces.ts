import { API_BASE } from '@/lib/api';

export const AI_TRACE_EMPTY = 'Chưa có AI trace';

export type PortfolioAiTraceSource = {
  id?: number;
  pattern?: string;
};

export type PortfolioAiTrace = {
  at: string;
  intent: string;
  sources: PortfolioAiTraceSource[];
  job_id: number;
  status: string;
  run_id?: string;
};

export type PortfolioAiTraceList = {
  items: PortfolioAiTrace[];
  forbidden: boolean;
};

export function formatAiTraceSources(sources: PortfolioAiTraceSource[] | undefined): string {
  if (!sources?.length) return '—';
  const labels = sources
    .map((row) => {
      const pattern = String(row.pattern ?? '').trim();
      if (pattern && row.id != null) return `#${row.id} ${pattern}`;
      if (pattern) return pattern;
      if (row.id != null) return `#${row.id}`;
      return '';
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

export function formatAiTraceTime(at: string | null | undefined): string {
  if (at == null || at === '') return '—';
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return at;
  return new Date(ms).toISOString();
}

export function mapAiTraceDisplay(row: PortfolioAiTrace): { time: string; intent: string; sources: string } {
  return {
    time: formatAiTraceTime(row.at),
    intent: String(row.intent ?? '').trim() || '—',
    sources: formatAiTraceSources(row.sources),
  };
}

export function shouldFetchAiTraces(canGenerate: boolean | null | undefined): boolean {
  return canGenerate !== false;
}

export function shouldShowAiTracePanel(input: {
  canGenerate?: boolean | null;
  forbidden?: boolean;
}): boolean {
  if (input.forbidden) return false;
  if (input.canGenerate === false) return false;
  return true;
}

function asTrace(row: unknown): PortfolioAiTrace | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Partial<PortfolioAiTrace>;
  const jobId = Number(item.job_id);
  if (!Number.isFinite(jobId)) return null;
  const sources = Array.isArray(item.sources)
    ? item.sources
        .map((src) => {
          if (!src || typeof src !== 'object') return null;
          const id = Number((src as PortfolioAiTraceSource).id);
          const pattern = String((src as PortfolioAiTraceSource).pattern ?? '');
          if (!Number.isFinite(id) && !pattern) return null;
          return {
            ...(Number.isFinite(id) ? { id } : {}),
            ...(pattern ? { pattern } : {}),
          };
        })
        .filter((src): src is PortfolioAiTraceSource => src != null)
    : [];
  return {
    at: String(item.at ?? ''),
    intent: String(item.intent ?? ''),
    sources,
    job_id: jobId,
    status: String(item.status ?? ''),
    ...(item.run_id ? { run_id: String(item.run_id) } : {}),
  };
}

export async function fetchPortfolioAiTraces(
  token: string,
  itemId: number,
  lifecycleHint?: number,
): Promise<PortfolioAiTraceList> {
  const qs = lifecycleHint && lifecycleHint > 0 ? `?lifecycle=${lifecycleHint}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/items/${itemId}/ai-traces${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) return { items: [], forbidden: true };
  if (!res.ok) return { items: [], forbidden: false };
  const body = (await res.json()) as { items?: unknown } | null;
  const items = Array.isArray(body?.items)
    ? body.items.map(asTrace).filter((row): row is PortfolioAiTrace => row != null)
    : [];
  return { items, forbidden: false };
}

export function resetAiTracePanelView(): PortfolioAiTraceList {
  return { items: [], forbidden: false };
}

export function aiTracePanelFromFetchFailure(err: unknown): PortfolioAiTraceList {
  return { items: [], forbidden: isForbiddenFetchError(err) };
}

export async function loadAiTracePanel(
  token: string,
  itemId: number,
  lifecycleHint?: number,
): Promise<PortfolioAiTraceList> {
  try {
    return await fetchPortfolioAiTraces(token, itemId, lifecycleHint);
  } catch (err) {
    return aiTracePanelFromFetchFailure(err);
  }
}

function isForbiddenFetchError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { status?: unknown; statusCode?: unknown };
  return Number(rec.status ?? rec.statusCode) === 403;
}

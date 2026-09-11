export const CMKT_GLOSSARY_STATUSES = ['Draft', 'Approved', 'Rejected'] as const;
export type CmktGlossaryStatus = (typeof CMKT_GLOSSARY_STATUSES)[number];

export type CmktGlossaryRow = {
  id: number;
  lifecycle_id: number;
  brand_id: string;
  term: string;
  locale: string;
  preferred: string;
  status: CmktGlossaryStatus;
  expires_at: string | null;
  created_at: string;
};

export type CopilotGlossarySource = {
  id: number;
  term: string;
  locale: string;
  brand_id: string;
  preferred: string;
  expires_at: string | null;
};

export function selectCopilotGlossary(
  rows: CmktGlossaryRow[],
  now = new Date(),
): CopilotGlossarySource[] {
  const nowMs = now.getTime();
  return rows
    .filter((row) => {
      if (row.status !== 'Approved') return false;
      if (row.expires_at == null || row.expires_at === '') return true;
      const expiresMs = Date.parse(row.expires_at);
      return Number.isFinite(expiresMs) && expiresMs > nowMs;
    })
    .map((row) => ({
      id: row.id,
      term: row.term,
      locale: row.locale,
      brand_id: row.brand_id,
      preferred: row.preferred,
      expires_at: row.expires_at,
    }));
}

export function formatCopilotGlossaryPromptSection(sources: CopilotGlossarySource[]): string {
  if (!sources.length) return '';
  return [
    'Approved glossary (copilot whitelist):',
    ...sources.map((row) => {
      const preferred = row.preferred?.trim();
      return preferred
        ? `- #${row.id} ${row.locale} ${row.term}: ${preferred}`
        : `- #${row.id} ${row.locale} ${row.term}`;
    }),
  ].join('\n');
}

export function copilotGlossaryFromContext(brandContext: Record<string, unknown>): CopilotGlossarySource[] {
  const raw = brandContext.copilotGlossary;
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is CopilotGlossarySource => {
    if (!row || typeof row !== 'object') return false;
    const item = row as Partial<CopilotGlossarySource>;
    return Number.isFinite(Number(item.id)) && typeof item.term === 'string';
  });
}

export function matchGlossaryTerms(text: string, terms: readonly string[]): string[] {
  const hay = String(text ?? '').toLowerCase();
  if (!hay || !terms.length) return [];
  return terms.filter((term) => {
    const needle = String(term ?? '').trim().toLowerCase();
    return needle.length > 0 && hay.includes(needle);
  });
}

export function isMissingGlossarySchema(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  if (code !== '42P01' && code !== '42703') return false;
  const message = err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  const table = String((err as { table?: unknown }).table ?? '');
  const column = String((err as { column?: unknown }).column ?? '');
  return /\bcmkt_glossary\b/i.test(`${message} ${table} ${column}`);
}

export function collectCopyText(body: {
  markdown?: string;
  html?: string;
  variants?: string[];
} | null | undefined): string {
  if (!body) return '';
  return [body.markdown, body.html, ...(body.variants ?? [])].filter(Boolean).join(' ');
}

export const CMKT_INSIGHT_STATUSES = ['Draft', 'Approved', 'Rejected', 'Outdated', 'Superseded'] as const;
export type CmktInsightStatus = (typeof CMKT_INSIGHT_STATUSES)[number];

export type CmktInsightRow = {
  id: number;
  lifecycle_id: number;
  pattern: string;
  evidence: string;
  confidence: number | null;
  status: CmktInsightStatus;
  scope_json: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
};

export type CopilotSource = {
  id: number;
  pattern: string;
  evidence: string;
  expires_at: string | null;
};

export function selectCopilotSources(insights: CmktInsightRow[], now = new Date()): CopilotSource[] {
  const nowMs = now.getTime();
  return insights
    .filter((row) => {
      if (row.status !== 'Approved') return false;
      if (row.expires_at == null || row.expires_at === '') return true;
      const expiresMs = Date.parse(row.expires_at);
      return Number.isFinite(expiresMs) && expiresMs > nowMs;
    })
    .map((row) => ({
      id: row.id,
      pattern: row.pattern,
      evidence: row.evidence,
      expires_at: row.expires_at,
    }));
}

export function formatCopilotSourcesPromptSection(sources: CopilotSource[]): string {
  if (!sources.length) return '';
  return [
    'Approved insights (copilot whitelist):',
    ...sources.map((row) => `- #${row.id} ${row.pattern}: ${row.evidence}`),
  ].join('\n');
}

export function copilotSourcesFromContext(brandContext: Record<string, unknown>): CopilotSource[] {
  const raw = brandContext.copilotSources;
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is CopilotSource => {
    if (!row || typeof row !== 'object') return false;
    const item = row as Partial<CopilotSource>;
    return Number.isFinite(Number(item.id)) && typeof item.pattern === 'string';
  });
}

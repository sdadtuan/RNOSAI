import type { KpiHubDictionaryRow, KpiHubGroupCode } from './kpi-hub-fixtures';
import { KPI_HUB_DICTIONARY } from './kpi-hub-fixtures';

const SOURCE_ALIASES: Record<string, string> = {
  crm: 'CRM',
  'meta ads': 'Meta Ads',
  meta: 'Meta Ads',
  ads: 'Meta Ads',
  'meta/google/tiktok ads': 'Meta Ads',
  sharepoint: 'SharePoint',
  erp: 'ERP',
  bank: 'Bank',
  'google ads': 'Google Ads',
  ga4: 'GA4',
  'call center': 'Call Center',
};

const GROUP_LABEL_TO_CODE: Record<string, KpiHubGroupCode> = {
  acquisition: 'ACQUISITION',
  'media efficiency': 'MEDIA_EFFICIENCY',
  funnel: 'FUNNEL',
  'sales outcome': 'SALES_OUTCOME',
  finance: 'FINANCE',
  operations: 'OPERATIONS',
};

export function parseSourceTags(source: string): string[] {
  if (!source?.trim()) return [];
  return source
    .split(/[+/,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const key = s.toLowerCase();
      return SOURCE_ALIASES[key] ?? s.replace(/\b\w/g, (c) => c.toUpperCase());
    });
}

export function groupLabelToCode(label: string): KpiHubGroupCode {
  const key = label.trim().toLowerCase();
  return GROUP_LABEL_TO_CODE[key] ?? 'ACQUISITION';
}

export function formatFrequencyLabel(raw: string): string {
  if (!raw?.trim()) return 'Daily';
  const lower = raw.toLowerCase();
  if (lower.includes('hàng ngày') || lower.includes('daily')) return 'Daily';
  if (lower.includes('hàng tháng') || lower.includes('monthly')) return 'Monthly';
  if (lower.includes('hàng tuần') || lower.includes('weekly')) return 'Weekly';
  return raw;
}

export function enrichDictionaryRow(row: KpiHubDictionaryRow): KpiHubDictionaryRow {
  const sources = row.sources?.length ? row.sources : parseSourceTags(row.source);
  const updatedAtLabel = row.updatedAtLabel ?? (row.updatedAt ? formatUpdatedAt(row.updatedAt) : undefined);
  return { ...row, sources, updatedAtLabel };
}

export function mergeFixtureEnrichment(row: KpiHubDictionaryRow): KpiHubDictionaryRow {
  const fixture = KPI_HUB_DICTIONARY.find((f) => f.code === row.code);
  if (!fixture) return enrichDictionaryRow(row);
  return enrichDictionaryRow({
    ...fixture,
    ...row,
    description: row.description ?? fixture.description,
    formulaDisplay: row.formulaDisplay ?? fixture.formulaDisplay,
    numeratorLabel: row.numeratorLabel ?? fixture.numeratorLabel,
    denominatorLabel: row.denominatorLabel ?? fixture.denominatorLabel,
    targetLabel: row.targetLabel ?? fixture.targetLabel,
    targetDescription: row.targetDescription ?? fixture.targetDescription,
    dataOwnerRole: row.dataOwnerRole ?? fixture.dataOwnerRole,
    dataOwnerEmail: row.dataOwnerEmail ?? fixture.dataOwnerEmail,
    sources: row.sources?.length ? row.sources : fixture.sources,
  });
}

export function uniqueOwners(rows: KpiHubDictionaryRow[]): string[] {
  return [...new Set(rows.map((r) => r.dataOwner).filter(Boolean))].sort();
}

export function formatUpdatedAt(raw?: string): string {
  if (!raw) return 'Hôm nay, 08:00';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Hôm nay, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

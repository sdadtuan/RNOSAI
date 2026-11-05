import type { LeadRow } from '@/lib/api';

export type LeadPropertyRow = {
  key: string;
  label: string;
  value: string;
  tone?: 'hot' | 'warm' | 'cold';
};

function bandLabel(band: LeadRow['ai_band']): string | null {
  if (band === 'hot') return 'Nóng';
  if (band === 'warm') return 'Ấm';
  if (band === 'cold') return 'Lạnh';
  return null;
}

function normField(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function leadPropertyRows(
  lead: Pick<
    LeadRow,
    'phone' | 'email' | 'source' | 'channel' | 'project_code' | 'ai_band' | 'created_at'
  >,
  ownerLabel?: string | null,
  opts?: { includeContactFields?: boolean; omitKeys?: string[] },
): LeadPropertyRow[] {
  const created = lead.created_at?.slice(0, 10) || '—';
  const band = bandLabel(lead.ai_band);
  const includeContact = opts?.includeContactFields !== false;
  const hidden = new Set(opts?.omitKeys ?? []);
  const contactRows: LeadPropertyRow[] = includeContact
    ? [
        { key: 'phone', label: 'SĐT', value: lead.phone?.trim() || '—' },
        { key: 'email', label: 'Email', value: lead.email?.trim() || '—' },
      ]
    : [];
  const sourceNorm = normField(lead.source);
  const channelNorm = normField(lead.channel);
  const showChannel = channelNorm !== '' && channelNorm !== sourceNorm;
  return [
    ...contactRows,
    { key: 'source', label: 'Nguồn', value: lead.source?.trim() || '—' },
    ...(showChannel
      ? [{ key: 'channel', label: 'Kênh', value: lead.channel?.trim() || '—' }]
      : []),
    { key: 'project', label: 'Dự án', value: lead.project_code?.trim() || '—' },
    { key: 'owner', label: 'Owner', value: ownerLabel?.trim() || 'Chưa phân' },
    { key: 'created', label: 'Ngày tạo', value: created },
    ...(band
      ? [{ key: 'band', label: 'Band', value: band, tone: lead.ai_band ?? undefined }]
      : []),
  ].filter((row) => !hidden.has(row.key));
}

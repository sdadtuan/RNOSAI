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

export function leadPropertyRows(
  lead: Pick<
    LeadRow,
    'phone' | 'email' | 'source' | 'channel' | 'project_code' | 'ai_band' | 'created_at'
  >,
  ownerLabel?: string | null,
): LeadPropertyRow[] {
  const created = lead.created_at?.slice(0, 10) || '—';
  const band = bandLabel(lead.ai_band);
  return [
    { key: 'source', label: 'Nguồn', value: lead.source?.trim() || '—' },
    { key: 'channel', label: 'Kênh', value: lead.channel?.trim() || '—' },
    { key: 'project', label: 'Dự án', value: lead.project_code?.trim() || '—' },
    { key: 'owner', label: 'Owner', value: ownerLabel?.trim() || 'Chưa phân' },
    { key: 'created', label: 'Ngày tạo', value: created },
    ...(band
      ? [{ key: 'band', label: 'Band', value: band, tone: lead.ai_band ?? undefined }]
      : []),
  ];
}

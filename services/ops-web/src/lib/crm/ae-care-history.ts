export type CareHistorySource = {
  lead_id: number;
  lead_name: string;
  status: string;
  staff_id: number;
  staff_name: string;
  staff_code: string;
  event_label: string;
  at: string;
};

export type CareHistoryLead = {
  lead_id: number;
  lead_name: string;
  status: string;
  staff: Array<{ id: number; name: string; code: string }>;
  latest_event: string;
  latest_at: string;
};

function stamp(raw: string): number {
  const value = raw.trim();
  if (!value) return 0;
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function collapseCareHistory(rows: CareHistorySource[]): CareHistoryLead[] {
  const map = new Map<number, CareHistoryLead & { at: number }>();
  for (const row of rows) {
    const at = stamp(row.at);
    let item = map.get(row.lead_id);
    if (!item) {
      item = {
        lead_id: row.lead_id,
        lead_name: row.lead_name,
        status: row.status,
        staff: [],
        latest_event: row.event_label,
        latest_at: row.at,
        at,
      };
      map.set(row.lead_id, item);
    }
    if (!item.staff.some((person) => person.id === row.staff_id)) {
      item.staff.push({ id: row.staff_id, name: row.staff_name, code: row.staff_code });
    }
    if (at >= item.at) {
      item.at = at;
      item.latest_event = row.event_label;
      item.latest_at = row.at;
      item.status = row.status || item.status;
      item.lead_name = row.lead_name || item.lead_name;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.at - a.at || b.lead_id - a.lead_id)
    .map(({ at: _at, ...lead }) => lead);
}

export function hideContactText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function assignmentReasonLabel(reason: string): string {
  const raw = reason.trim();
  if (!raw) return '';
  if (/[=;]|hybrid|analytics|ops-web/i.test(raw) || /^[a-z0-9_:-]+$/i.test(raw)) {
    return 'Chuyển người phụ trách';
  }
  return hideContactText(raw);
}

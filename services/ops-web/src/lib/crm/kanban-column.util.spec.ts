import { describe, expect, it } from 'vitest';
import { isB2bLeadP1, sortKanbanLeads } from './kanban-column.util';
import type { LeadRow } from '@/lib/api';

function lead(partial: Partial<LeadRow> & Pick<LeadRow, 'id'>): LeadRow {
  return {
    full_name: 'A',
    phone: '',
    email: '',
    status: 'moi',
    source: '',
    channel: '',
    client_id: null,
    owner_id: null,
    created_at: '2026-10-01T00:00:00.000Z',
    received_at: '2026-10-01T00:00:00.000Z',
    is_duplicate: false,
    ...partial,
  };
}

describe('kanban column order', () => {
  it('puts late before almost-late, then hot, warm, cold, newest first', () => {
    const rows = [
      lead({ id: 1, ai_band: 'cold', sla_state: 'ok', received_at: '2026-10-12T00:00:00.000Z' }),
      lead({ id: 2, ai_band: 'hot', sla_state: 'ok', received_at: '2026-10-10T00:00:00.000Z' }),
      lead({ id: 3, ai_band: 'cold', sla_state: 'breach', received_at: '2026-10-09T00:00:00.000Z' }),
      lead({ id: 4, ai_band: 'warm', sla_state: 'warning', received_at: '2026-10-11T00:00:00.000Z' }),
      lead({ id: 5, ai_band: 'hot', sla_state: 'ok', received_at: '2026-10-13T00:00:00.000Z' }),
    ];
    expect(sortKanbanLeads(rows).map((row) => row.id)).toEqual([3, 4, 5, 2, 1]);
  });

  it('treats Lead P1 as hot and late or almost late', () => {
    expect(isB2bLeadP1(lead({ id: 1, ai_band: 'hot', sla_state: 'breach' }))).toBe(true);
    expect(isB2bLeadP1(lead({ id: 2, ai_band: 'hot', sla_state: 'warning' }))).toBe(true);
    expect(isB2bLeadP1(lead({ id: 3, ai_band: 'hot', sla_state: 'ok' }))).toBe(false);
    expect(isB2bLeadP1(lead({ id: 4, ai_band: 'warm', sla_state: 'breach' }))).toBe(false);
  });
});

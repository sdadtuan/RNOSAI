import { describe, expect, it } from 'vitest';
import { normalizeDeliveryRow, parseDeliveryProjectList } from './delivery-projects-api';

describe('parseDeliveryProjectList', () => {
  it('parses list from items wrapper', () => {
    const rows = parseDeliveryProjectList({
      items: [
        {
          id: 'd1',
          name: 'An Gia',
          capabilities: ['lead_ingest'],
          status: 'draft',
          health_status: 'stable',
        },
      ],
    });
    expect(rows[0].name).toBe('An Gia');
    expect(rows[0].capabilities).toEqual(['lead_ingest']);
  });

  it('parses bare array response', () => {
    const rows = parseDeliveryProjectList([
      { id: 'd2', name: 'PRJ Demo', capabilities: ['delivery'], code: 'PRJ-001', health_status: 'no_data' },
    ]);
    expect(rows[0].code).toBe('PRJ-001');
  });

  it('returns empty for invalid body', () => {
    expect(parseDeliveryProjectList(null)).toEqual([]);
  });
});

describe('normalizeDeliveryRow', () => {
  it('normalizes ingest fields', () => {
    const row = normalizeDeliveryRow({
      id: 'x',
      name: 'Legacy',
      ingest_status: 'active',
      ingest_code: 'ptt-legacy',
    });
    expect(row.ingest_status).toBe('active');
    expect(row.ingest_code).toBe('ptt-legacy');
  });
});

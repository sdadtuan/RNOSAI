import { describe, expect, it } from 'vitest';
import { parseActualImportCsv } from './service-kpi-csv';

describe('parseActualImportCsv', () => {
  it('parses rows with instance_id header', () => {
    const csv = `instance_id,period_start,period_end,value,quality_status,source_ref
abc-1,2026-10-07,2026-10-07,128000,valid,meta+crm`;
    const rows = parseActualImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      instance_id: 'abc-1',
      period_start: '2026-10-07',
      value: 128000,
    });
  });

  it('parses rows with dictionary_id and source_id', () => {
    const csv = `dictionary_id,source_id,period_start,period_end,value
dict-1,qt-line,2026-10-01,2026-10-07,95000`;
    const rows = parseActualImportCsv(csv);
    expect(rows[0]).toMatchObject({
      dictionary_id: 'dict-1',
      source_id: 'qt-line',
      value: 95000,
    });
  });
});

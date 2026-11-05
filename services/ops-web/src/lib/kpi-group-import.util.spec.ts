import { describe, expect, it } from 'vitest';
import { KPI_GROUP_IMPORT_TEMPLATE, parseKpiGroupImportCsv } from '@/lib/kpi-group-import.util';

describe('parseKpiGroupImportCsv', () => {
  it('parses template sample row', () => {
    const { rows, preview, headerError } = parseKpiGroupImportCsv(KPI_GROUP_IMPORT_TEMPLATE);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(preview[0]?.valid).toBe(true);
    expect(rows[0]?.code).toBe('GROWTH_SAMPLE');
  });

  it('flags invalid header', () => {
    const out = parseKpiGroupImportCsv('code,name\nX,Y');
    expect(out.headerError).toBeTruthy();
    expect(out.rows).toEqual([]);
  });
});

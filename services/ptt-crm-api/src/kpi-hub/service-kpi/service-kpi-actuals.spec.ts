import { detectDuplicateActual } from './service-kpi-actuals';

describe('detectDuplicateActual', () => {
  it('detects same period+source as duplicate (AC-SKPI-04)', () => {
    expect(
      detectDuplicateActual(
        { periodStart: '2026-10-07', periodEnd: '2026-10-07', sourceRef: 'meta+crm', quality: 'valid' },
        { periodStart: '2026-10-07', periodEnd: '2026-10-07', sourceRef: 'meta+crm' },
      ),
    ).toBe('duplicate');
  });
});

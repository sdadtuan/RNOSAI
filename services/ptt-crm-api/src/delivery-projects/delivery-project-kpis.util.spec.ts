import { assertKpisAttachable } from './delivery-project-kpis.util';

describe('assertKpisAttachable', () => {
  it('rejects deprecated KPIs', () => {
    const result = assertKpisAttachable([{ dictionary_id: 'd1', status: 'DEPRECATED' }]);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('KPI_DEPRECATED');
  });

  it('rejects duplicate dictionary_id in request', () => {
    const result = assertKpisAttachable([
      { dictionary_id: 'd1', status: 'ACTIVE' },
      { dictionary_id: 'd1', status: 'ACTIVE' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('KPI_DUPLICATE');
  });

  it('rejects already attached KPIs', () => {
    const result = assertKpisAttachable([{ dictionary_id: 'd1', status: 'ACTIVE' }], ['d1']);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('KPI_DUPLICATE');
  });

  it('accepts active unique KPIs', () => {
    const result = assertKpisAttachable([
      { dictionary_id: 'd1', status: 'ACTIVE' },
      { dictionary_id: 'd2', status: 'ACTIVE' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

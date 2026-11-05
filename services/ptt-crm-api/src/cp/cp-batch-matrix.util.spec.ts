import { expandBatchMatrix, matrixExpansionCount } from './cp-batch-matrix.util';

describe('cp-batch-matrix.util', () => {
  const base = [{
    project_name: 'The Peak',
    price_from: '3 tỷ',
    location: 'Q7',
    cta: 'Form',
    hotline: '1900',
  }];

  it('expands ratio × locale × channel × cta', () => {
    const out = expandBatchMatrix(base, {
      ratios: ['9:16', '1:1'],
      locales: ['vi', 'en'],
      channels: ['meta'],
      ctas: ['Form', 'Gọi ngay'],
    });
    expect(out).toHaveLength(8);
    expect(out[0]).toMatchObject({
      ratio: '9:16',
      locale: 'vi',
      channel: 'meta',
      cta: 'Form',
      variant_key: '9:16|vi|meta|Form',
    });
  });

  it('counts expansion without materializing rows', () => {
    expect(matrixExpansionCount(2, {
      ratios: ['9:16', '4:5'],
      locales: ['vi'],
      channels: ['meta', 'google'],
      ctas: ['A'],
    })).toBe(8);
  });
});

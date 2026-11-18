import { describe, expect, it } from 'vitest';
import { generateColorSizeVariants, splitVariantTokens } from './portal-pos-variants.util';

describe('generateColorSizeVariants', () => {
  it('builds the color × size grid and skips combos that already exist', () => {
    const rows = generateColorSizeVariants(
      [{ color: 'Đen', size: 'M', sku: 'DM', id: '1' }, { color: '', size: '', sku: '' }],
      splitVariantTokens('Đen, Trắng, Đen'),
      splitVariantTokens('S, M'),
      (color, size) => ({ color, size, sku: '', id: '' }),
    );
    expect(rows.map((row) => `${row.color}/${row.size}`)).toEqual(['Đen/M', 'Đen/S', 'Trắng/S', 'Trắng/M']);
  });
});
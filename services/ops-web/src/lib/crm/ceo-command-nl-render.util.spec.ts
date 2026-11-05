import { describe, expect, it } from 'vitest';
import { rowsToTable, sparkPoints } from './ceo-command-nl-render.util';

describe('ceo-command-nl-render.util', () => {
  it('rowsToTable caps at 12', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ n: i }));
    expect(rowsToTable(rows)).toHaveLength(12);
  });

  it('sparkPoints returns polyline', () => {
    expect(sparkPoints([1, 3, 2])).toContain('0.0');
  });
});

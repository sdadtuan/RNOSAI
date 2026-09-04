import { buildCommandTiles } from './command-center.builder';

describe('buildCommandTiles', () => {
  it('emits six executive tiles and blank actual as null not zero', () => {
  const tiles = buildCommandTiles({
    persona: 'executive',
    facts: new Map([['SAL_008', 1_240_000_000], ['MKT_002', null]]),
    prevFacts: new Map([['SAL_008', 1_000_000_000]]),
    targets: new Map([
      ['SAL_008', { target: 1_200_000_000, warning: null, critical: null, direction: 'HIGHER_IS_BETTER', name: 'Doanh thu kỳ mới' }],
      ['MKT_002', { target: 100, warning: null, critical: null, direction: 'HIGHER_IS_BETTER', name: 'Valid Leads' }],
    ]),
    freshnessByCode: new Map(),
    dqCritical: false,
    sparklines: new Map(),
    format: (_c, v) => (v == null ? '—' : String(v)),
  });
  expect(tiles).toHaveLength(6);
  expect(tiles[0].code).toBe('SAL_008');
  expect(tiles[0].delta_pct).toBe(24);
  expect(tiles.find((t) => t.code === 'MKT_002')?.formatted).toBe('—');
  expect(tiles.find((t) => t.code === 'MKT_002')?.actual).toBeNull();
  });
});

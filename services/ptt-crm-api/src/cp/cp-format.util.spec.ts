import { emptyKpis } from './cp.types';
import { kpiOrNull } from './cp-format.util';

it('empty book KPIs are null not zero', () => {
  const k = emptyKpis();
  expect(k.videos_created).toBeNull();
  expect(k.credits_used).toBeNull();
  expect(Object.keys(k)).toHaveLength(8);
});

it('kpiOrNull treats missing as null', () => {
  expect(kpiOrNull(undefined)).toBeNull();
  expect(kpiOrNull(0)).toBe(0);
});

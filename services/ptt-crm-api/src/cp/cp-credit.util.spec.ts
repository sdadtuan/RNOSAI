import { canChargeIdempotent, hardCapBlocks } from './cp-credit.util';

it('second reserve with same idempotency key does not add', () => {
  expect(canChargeIdempotent('k1', 'k1')).toBe(false);
  expect(canChargeIdempotent(null, 'k1')).toBe(true);
});

it('hard cap blocks when used+reserve >= allocated', () => {
  expect(hardCapBlocks({ allocated: 100, used: 80, reserve: 20, hard: true })).toBe(true);
  expect(hardCapBlocks({ allocated: 100, used: 80, reserve: 19, hard: true })).toBe(false);
});

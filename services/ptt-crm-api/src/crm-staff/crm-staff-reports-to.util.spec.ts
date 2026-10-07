import { reportsToWouldCycle } from './crm-staff-reports-to.util';

describe('reportsToWouldCycle', () => {
  it('allows clearing manager', () => {
    expect(reportsToWouldCycle(3, null, new Map([[3, 2], [2, 1]]))).toBe(false);
  });

  it('forbids self as manager', () => {
    expect(reportsToWouldCycle(3, 3, new Map())).toBe(true);
  });

  it('forbids assigning a descendant as manager', () => {
    const edges = new Map<number, number | null>([
      [1, null],
      [2, 1],
      [3, 2],
    ]);
    expect(reportsToWouldCycle(1, 3, edges)).toBe(true);
    expect(reportsToWouldCycle(3, 1, edges)).toBe(false);
  });
});

import { ancestorIds, descendantIds, isOnPath } from './iwr-org.util';
import type { IwrStaffNode } from './iwr.types';

const nodes: IwrStaffNode[] = [
  { id: 1, name: 'CEO', email: 'c@x', department_id: 10, reports_to_id: null, active: true },
  { id: 2, name: 'TL', email: 't@x', department_id: 10, reports_to_id: 1, active: true },
  { id: 3, name: 'NV', email: 'n@x', department_id: 10, reports_to_id: 2, active: true },
  { id: 4, name: 'AM', email: 'a@x', department_id: 20, reports_to_id: 1, active: true },
];

describe('iwr-org.util', () => {
  it('walks ancestors and descendants', () => {
    expect(ancestorIds(3, nodes)).toEqual([2, 1]);
    expect(descendantIds(2, nodes).sort()).toEqual([3]);
    expect(isOnPath(1, 3, nodes)).toBe(true);
    expect(isOnPath(3, 4, nodes)).toBe(false);
  });
});

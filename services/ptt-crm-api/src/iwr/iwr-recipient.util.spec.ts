import { assertW1Recipients } from './iwr-recipient.util';
import type { IwrActor, IwrStaffNode } from './iwr.types';

const nodes: IwrStaffNode[] = [
  { id: 1, name: 'CEO', email: 'c@x', department_id: 10, reports_to_id: null, active: true },
  { id: 2, name: 'TL', email: 't@x', department_id: 10, reports_to_id: 1, active: true },
  { id: 3, name: 'NV', email: 'n@x', department_id: 10, reports_to_id: 2, active: true },
  { id: 4, name: 'AM', email: 'a@x', department_id: 20, reports_to_id: 1, active: true },
];

describe('iwr-recipient.util', () => {
  it('locks To to direct manager and blocks other-dept Cc', () => {
    const author = nodes[2];
    const actor: IwrActor = { staffId: 3, staffLabel: 'NV', departmentId: 10, caps: [] };
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [], bccIds: [] }),
    ).not.toThrow();
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [1], ccIds: [], bccIds: [] }),
    ).toThrow('iwr_to_locked');
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [4], bccIds: [] }),
    ).toThrow('iwr_cc_not_allowed');
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [], bccIds: [1] }),
    ).toThrow('iwr_bcc_forbidden');
  });

  it('allows same-dept Cc and manage bypass for Cc only', () => {
    const author = nodes[2];
    const actor: IwrActor = {
      staffId: 3,
      staffLabel: 'NV',
      departmentId: 10,
      caps: [{ section: 'iwr', action: 'manage' }],
    };
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [1], bccIds: [] }),
    ).not.toThrow();
    expect(() =>
      assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [4], bccIds: [] }),
    ).not.toThrow();
  });
});

import { assertCanReceive, filterRecipientsForViewer, replyAllRecipientIds } from './iwr-recipient.util';
import type { IwrActor, IwrRecipientRow, IwrReportRow, IwrStaffNode } from './iwr.types';

describe('assertCanReceive W3', () => {
  const author: IwrStaffNode = {
    id: 3,
    name: 'NV',
    email: 'n',
    department_id: 10,
    reports_to_id: 2,
    active: true,
  };
  const nodes: IwrStaffNode[] = [
    { id: 2, name: 'QLTT', email: 't', department_id: 10, reports_to_id: 1, active: true },
    author,
    { id: 4, name: 'HR', email: 'h', department_id: 20, reports_to_id: 1, active: true },
  ];

  it('allows Bcc when cap + policy allow_bcc', () => {
    const actor: IwrActor = {
      staffId: 3,
      staffLabel: 'NV',
      departmentId: 10,
      caps: [{ section: 'iwr', action: 'bcc' }, { section: 'iwr', action: 'write' }],
    };
    expect(() =>
      assertCanReceive({
        actor,
        author,
        nodes,
        toIds: [2],
        ccIds: [],
        bccIds: [4],
        policy: { allow_bcc: true, cc_mode: 'w1' },
      }),
    ).not.toThrow();
  });

  it('forbids Bcc without cap', () => {
    const actor: IwrActor = {
      staffId: 3,
      staffLabel: 'NV',
      departmentId: 10,
      caps: [{ section: 'iwr', action: 'write' }],
    };
    expect(() =>
      assertCanReceive({
        actor,
        author,
        nodes,
        toIds: [2],
        ccIds: [],
        bccIds: [4],
        policy: { allow_bcc: true, cc_mode: 'w1' },
      }),
    ).toThrow('iwr_bcc_forbidden');
  });

  it('hides Bcc from non-sender GET', () => {
    const recipients: IwrRecipientRow[] = [
      { id: '1', report_id: 'r', staff_id: 2, kind: 'to' },
      { id: '2', report_id: 'r', staff_id: 4, kind: 'bcc', staff_name: 'HR' },
    ];
    const report = { author_staff_id: 3 } as IwrReportRow;
    const actor: IwrActor = { staffId: 5, staffLabel: 'X', departmentId: 10, caps: [] };
    const filtered = filterRecipientsForViewer(actor, report, recipients);
    expect(filtered.some((r) => r.kind === 'bcc')).toBe(false);
  });

  it('reply-all excludes Bcc staff 99', () => {
    const recipients: IwrRecipientRow[] = [
      { id: '1', report_id: 'r', staff_id: 2, kind: 'to' },
      { id: '2', report_id: 'r', staff_id: 5, kind: 'cc' },
      { id: '3', report_id: 'r', staff_id: 99, kind: 'bcc' },
    ];
    const ids = replyAllRecipientIds(recipients, 3, 5);
    expect(ids).not.toContain(99);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).not.toContain(5);
  });
});

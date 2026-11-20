import { describe, expect, it } from 'vitest';
import {
  currentOwnerIdForKind,
  ownerKindFromHandoffStep,
  staffForOwnerKind,
  type LeadOwnerKind,
} from './LeadOwnerReassignControl';
import type { CrmStaffRow } from '@/lib/api';

function staff(partial: Partial<CrmStaffRow> & { id: number; name: string }): CrmStaffRow {
  return {
    active: 1,
    job_title: '',
    department: '',
    ...partial,
  } as CrmStaffRow;
}

describe('ownerKindFromHandoffStep', () => {
  it('maps the 7-step handoff to the owner kind SUPER-ADMIN can reassign', () => {
    const cases: Array<[string, LeadOwnerKind]> = [
      ['receive_lead', 'sales'],
      ['sales_brief', 'sales'],
      ['await_solutions', 'am'],
      ['doing_solutions', 'solution'],
      ['await_quote', 'quote_am'],
      ['negotiate', 'quote_am'],
      ['sign_contract', 'quote_am'],
    ];
    for (const [step, kind] of cases) {
      expect(ownerKindFromHandoffStep(step)).toBe(kind);
    }
  });
});

describe('currentOwnerIdForKind', () => {
  const ids = { sales: 107, assignedAm: 1, solution: 108, quoteAm: 2 };
  it('picks the column that belongs to the current stage', () => {
    expect(currentOwnerIdForKind('sales', ids)).toBe(107);
    expect(currentOwnerIdForKind('am', ids)).toBe(1);
    expect(currentOwnerIdForKind('acm', ids)).toBe(1);
    expect(currentOwnerIdForKind('solution', ids)).toBe(108);
    expect(currentOwnerIdForKind('quote_am', ids)).toBe(2);
  });
});

describe('staffForOwnerKind', () => {
  const rows = [
    staff({ id: 107, name: 'Sale Local', job_title: 'Account Executive', can_receive_leads: true }),
    staff({ id: 2, name: 'Khoa', job_title: 'Account Manager', position_catalog_code: 'am' }),
    staff({ id: 9, name: 'Care', job_title: 'Account Care Manager', position_catalog_code: 'acm' }),
    staff({ id: 108, name: 'MKT', job_title: 'Marketing Leader', can_receive_solution: true }),
  ];

  it('includes AM and ACM staff for the step-3 handoff assignee', () => {
    expect(staffForOwnerKind(rows, 'am').map((row) => row.id).sort()).toEqual([2, 9]);
  });

  it('limits solution picker to flagged staff unless SUPER-ADMIN', () => {
    expect(staffForOwnerKind(rows, 'solution').map((row) => row.id)).toEqual([108]);
    expect(
      staffForOwnerKind(rows, 'solution', { superAdmin: true })
        .map((row) => row.id)
        .sort((a, b) => a - b),
    ).toEqual([2, 9, 107, 108]);
  });

  it('does not fall back to all active staff when solution pool is empty', () => {
    const noFlag = rows.filter((r) => r.id !== 108);
    expect(staffForOwnerKind(noFlag, 'solution')).toEqual([]);
  });
});
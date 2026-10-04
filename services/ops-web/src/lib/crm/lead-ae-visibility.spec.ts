import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import type { LeadAuditBundle } from '@/lib/api';
import { isAccountExecutive, leadAuditForViewer } from './lead-ae-visibility';

function viewer(partial: Partial<StoredStaffUser>): StoredStaffUser {
  return {
    id: '12',
    email: 'nha.phuong@pttads.vn',
    display_name: 'Trương Thị Nhã Phương',
    position_id: 4,
    position_code: 'AE',
    job_functions: ['sales'],
    ...partial,
  };
}

const audit: LeadAuditBundle = {
  status_logs: [
    { id: 1, lead_id: 8, old_status: 'first_contact', new_status: 'moi', changed_by: 'system@pttads.vn', note: '', created_at: '2026-09-15T08:00:00' },
    { id: 2, lead_id: 8, old_status: 'moi', new_status: 'bant', changed_by: 'nha.phuong@pttads.vn', note: 'AE cập nhật', created_at: '2026-09-16T08:00:00' },
  ],
  assignment_logs: [
    { id: 9, lead_id: 8, from_user_id: null, from_name: '—', to_user_id: 10, to_name: 'Dương Thị Thảo Vi', reason: 'pool', created_by: 'gdkd@pttads.vn', created_at: '2026-09-30T08:00:00' },
    { id: 10, lead_id: 8, from_user_id: 10, from_name: 'Dương Thị Thảo Vi', to_user_id: 12, to_name: 'Trương Thị Nhã Phương', reason: 'giao AE', created_by: 'gdkd@pttads.vn', created_at: '2026-10-01T08:00:00' },
  ],
};

describe('lead AE visibility', () => {
  it('treats position AE as an account executive', () => {
    expect(isAccountExecutive(viewer({}))).toBe(true);
    expect(isAccountExecutive(viewer({ position_code: 'GDKD-01', job_functions: ['sales'] }))).toBe(false);
    expect(isAccountExecutive(viewer({ position_code: 'KD-01' }))).toBe(false);
  });

  it('hides assign-unrelated audit and keeps only rows about this AE', () => {
    const visible = leadAuditForViewer(audit, viewer({}));
    expect(visible?.status_logs.map((row) => row.id)).toEqual([2]);
    expect(visible?.assignment_logs.map((row) => row.id)).toEqual([10]);
  });

  it('hides the audit panel when nothing names this AE', () => {
    expect(leadAuditForViewer({
      status_logs: audit.status_logs.slice(0, 1),
      assignment_logs: audit.assignment_logs.slice(0, 1),
    }, viewer({}))).toBeNull();
  });

  it('leaves the full audit for a non-AE', () => {
    expect(leadAuditForViewer(audit, viewer({ position_code: 'GDKD-01' }))).toBe(audit);
  });
});

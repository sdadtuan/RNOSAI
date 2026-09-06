import { describe, expect, it } from 'vitest';
import type { CrmStaffRow } from '@/lib/api';
import { parseVndInput, suggestAssignees } from './revops-modal.util';

describe('revops-modal.util', () => {
  it('parseVndInput strips non-digits', () => {
    expect(parseVndInput('450,000,000')).toBe(450_000_000);
    expect(parseVndInput('')).toBeNull();
  });

  it('suggestAssignees rotates by lead id', () => {
    const staff = [
      { id: 1, name: 'A', active: 1, can_receive_leads: true },
      { id: 2, name: 'B', active: 1, can_receive_leads: true },
      { id: 3, name: 'C', active: 1, can_receive_leads: true },
    ] as CrmStaffRow[];
    expect(suggestAssignees(staff, 1, 2).map((s) => s.id)).toEqual([2, 3]);
    expect(suggestAssignees(staff, 2, 2).map((s) => s.id)).toEqual([3, 1]);
  });
});

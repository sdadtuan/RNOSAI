import { describe, expect, it } from 'vitest';
import {
  addStaffDraft,
  leadReceiveBlock,
  patchStaffDraft,
  removeStaffDraft,
  staffDraftPayload,
  staffRowsToDraft,
} from './b2b-project-staff-draft';

describe('b2b project staff draft', () => {
  const current = staffRowsToDraft([
    {
      staff_id: 4,
      name: 'Đặng Công Quốc',
      assign_enabled: true,
      sales_level: 'b',
      role: 'sales',
      active: false,
      can_receive_leads: false,
    },
    {
      staff_id: 7,
      name: 'Mỹ Ngọc',
      assign_enabled: true,
      sales_level: 'b',
      role: 'project_manager',
      active: true,
      can_receive_leads: true,
    },
  ]);

  it('adds a person with the chosen role and position, without dropping current members', () => {
    const next = addStaffDraft(current, {
      id: 10,
      name: 'Thảo Vi',
      job_title: 'AE',
      active: true,
      can_receive_leads: true,
      role: 'sales',
      sales_level: 'a',
    });
    expect(next.map((row) => row.staff_id)).toEqual([4, 7, 10]);
    expect(next[2]).toMatchObject({
      assign_enabled: true,
      sales_level: 'a',
      role: 'sales',
      active: true,
      can_receive_leads: true,
    });
    expect(staffDraftPayload(next)[2]).toEqual({
      staff_id: 10,
      assign_enabled: true,
      sales_level: 'a',
      role: 'sales',
    });
  });

  it('ignores a duplicate add', () => {
    expect(
      addStaffDraft(current, {
        id: 7,
        name: 'Mỹ Ngọc',
        active: true,
        can_receive_leads: true,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toHaveLength(2);
  });

  it('patches one row and keeps the project manager role in the save payload', () => {
    const next = patchStaffDraft(current, 7, { assign_enabled: false, sales_level: 'a' });
    expect(staffDraftPayload(next)).toEqual([
      { staff_id: 4, assign_enabled: true, sales_level: 'b', role: 'sales' },
      { staff_id: 7, assign_enabled: false, sales_level: 'a', role: 'project_manager' },
    ]);
  });

  it('removes only the chosen person', () => {
    expect(removeStaffDraft(current, 4).map((row) => row.staff_id)).toEqual([7]);
  });

  it('rejects a sales level outside s/a/b/c', () => {
    expect(() => patchStaffDraft(current, 7, { sales_level: 'x' as 'b' })).toThrow('invalid_sales_level');
  });

  it('blocks add when the person is inactive or cannot receive leads', () => {
    expect(leadReceiveBlock({ active: true, can_receive_leads: true })).toBeNull();
    expect(leadReceiveBlock({ active: false, can_receive_leads: true })).toBe('inactive');
    expect(leadReceiveBlock({ active: true, can_receive_leads: false })).toBe('cannot_receive_leads');
    expect(leadReceiveBlock({ active: false, can_receive_leads: false })).toBe('inactive');
    expect(() =>
      addStaffDraft(current, {
        id: 21,
        name: 'Mới',
        active: false,
        can_receive_leads: true,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toThrow('inactive');
    expect(() =>
      addStaffDraft(current, {
        id: 22,
        name: 'Mới',
        active: true,
        can_receive_leads: false,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toThrow('cannot_receive_leads');
  });

  it('rejects a role outside sales and project_manager', () => {
    expect(() =>
      addStaffDraft(current, {
        id: 23,
        name: 'Mới',
        active: true,
        can_receive_leads: true,
        role: 'director' as 'sales',
        sales_level: 'b',
      }),
    ).toThrow('invalid_role');
  });

  it('refuses to turn project assign on when the person fails either flag', () => {
    expect(() => patchStaffDraft(current, 4, { assign_enabled: true })).toThrow('inactive');
  });
});

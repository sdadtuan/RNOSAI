import { maskSections, canSeeSensitiveField } from './iwr-masking.util';
import type { IwrActor } from './iwr.types';

const am: IwrActor = {
  staffId: 10,
  staffLabel: 'AM',
  departmentId: 1,
  caps: [{ section: 'iwr', action: 'view' }],
};

const hrLead: IwrActor = {
  staffId: 20,
  staffLabel: 'HR',
  departmentId: 2,
  caps: [
    { section: 'iwr', action: 'view' },
    { section: 'hr', action: 'view' },
  ],
};

describe('iwr-masking.util', () => {
  it('AM cannot see people section when sensitivity hr', () => {
    const sections = {
      people: { body: 'salary notes', items: [{ x: 1 }] },
      done: { body: 'ok', items: [] },
    };
    const masked = maskSections(sections, [{ key: 'people', sensitivity: 'hr' }], am);
    expect((masked.people as { body: string }).body).toBe('***');
    expect((masked.people as { items: unknown[] }).items).toEqual([]);
    expect((masked.done as { body: string }).body).toBe('ok');
  });

  it('HR viewer sees people section', () => {
    expect(canSeeSensitiveField(hrLead, 'hr')).toBe(true);
    const sections = { people: { body: 'salary notes', items: [] } };
    const masked = maskSections(sections, [{ key: 'people', sensitivity: 'hr' }], hrLead);
    expect((masked.people as { body: string }).body).toBe('salary notes');
  });

  it('executive cap sees finance fields', () => {
    const exec: IwrActor = {
      staffId: 1,
      staffLabel: 'CEO',
      departmentId: null,
      caps: [{ section: 'iwr', action: 'executive' }],
    };
    expect(canSeeSensitiveField(exec, 'finance')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { mergeLeadgenForms } from './merge-leadgen-forms';

describe('mergeLeadgenForms', () => {
  it('adds Graph forms and drops the empty placeholder row', () => {
    const out = mergeLeadgenForms(
      [{ form_id: '', name: '', active: true }],
      [
        { form_id: '106', name: 'Lead PTT', active: true },
        { form_id: '107', name: 'Cũ', active: false },
      ],
    );
    expect(out).toEqual([
      { form_id: '106', name: 'Lead PTT', active: true },
      { form_id: '107', name: 'Cũ', active: false },
    ]);
  });

  it('updates the name of a mapped form and keeps its Active flag', () => {
    const out = mergeLeadgenForms(
      [
        { form_id: '106', name: '', active: false },
        { form_id: 'manual', name: 'Tay', active: true },
      ],
      [{ form_id: '106', name: 'Lead PTT', active: true }],
    );
    expect(out).toEqual([
      { form_id: '106', name: 'Lead PTT', active: false },
      { form_id: 'manual', name: 'Tay', active: true },
    ]);
  });

  it('leaves the draft unchanged when Graph returns nothing', () => {
    const existing = [{ form_id: '106', name: 'Lead PTT', active: true }];
    expect(mergeLeadgenForms(existing, [])).toEqual(existing);
  });
});
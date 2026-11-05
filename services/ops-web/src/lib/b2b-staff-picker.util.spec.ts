import { describe, expect, it } from 'vitest';
import { b2bStaffPickerLabel, b2bStaffPickerOptions } from './b2b-staff-picker.util';

describe('b2bStaffPickerLabel', () => {
  it('joins name, code and email', () => {
    expect(
      b2bStaffPickerLabel({
        id: 7,
        name: 'Lan',
        internal_code: 'PTTCN100007',
        email: 'lan@pttads.vn',
      }),
    ).toBe('Lan · PTTCN100007 · lan@pttads.vn');
  });
});

describe('b2bStaffPickerOptions', () => {
  it('keeps assigned staff even if not eligible', () => {
    const opts = b2bStaffPickerOptions([{ id: 2, name: 'Binh' }], [9]);
    expect(opts.map((o) => o.value)).toEqual(['2', '9']);
    expect(opts.find((o) => o.value === '9')?.label).toBe('NV #9');
  });
});

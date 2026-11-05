import { describe, expect, it } from 'vitest';
import { iwrAccountName, iwrDepartmentLabel, iwrInitials } from './iwr-format';

describe('iwr account label', () => {
  it('uses the staff display name and team, never a hardcoded department', () => {
    expect(iwrAccountName({ display_name: 'Trần Thị Lan', email: 'lan@ptt.vn' })).toBe('Trần Thị Lan');
    expect(iwrInitials('Trần Thị Lan')).toBe('TL');
    expect(iwrDepartmentLabel([{ name: 'Kinh doanh' }, { name: 'PTT' }])).toBe('Kinh doanh, PTT');
    expect(iwrDepartmentLabel([])).toBe('—');
    expect(iwrDepartmentLabel(undefined)).toBe('—');
  });

  it('falls back to email when the display name is empty', () => {
    expect(iwrAccountName({ display_name: '  ', email: 'lan@ptt.vn' })).toBe('lan@ptt.vn');
    expect(iwrAccountName(null)).toBe('Tài khoản');
  });
});

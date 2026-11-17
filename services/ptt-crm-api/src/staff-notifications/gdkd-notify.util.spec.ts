import { isGdkdPositionCode } from './gdkd-notify.util';

describe('isGdkdPositionCode', () => {
  it('matches GDKD codes and leaves CEO alone', () => {
    expect(isGdkdPositionCode('GDKD')).toBe(true);
    expect(isGdkdPositionCode('gdkd-01')).toBe(true);
    expect(isGdkdPositionCode('GD KD')).toBe(true);
    expect(isGdkdPositionCode('CEO')).toBe(false);
    expect(isGdkdPositionCode('ACM')).toBe(false);
    expect(isGdkdPositionCode('')).toBe(false);
  });
});

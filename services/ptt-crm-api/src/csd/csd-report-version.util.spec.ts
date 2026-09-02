import { bumpReportVersion } from './csd-report-version.util';

describe('csd-report-version.util', () => {
  describe('bumpReportVersion', () => {
    it('bumps minor before send and major after send', () => {
      expect(bumpReportVersion('v1.0', 'minor')).toBe('v1.1');
      expect(bumpReportVersion('v1.2', 'minor')).toBe('v1.3');
      expect(bumpReportVersion('v1.2', 'major')).toBe('v2.0');
      expect(bumpReportVersion('bad', 'major')).toBe('v2.0');
    });
  });
});

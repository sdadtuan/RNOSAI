import { assertMime, rightsStatus } from './cp-assets.service';

describe('CpAssetsService', () => {
  it('rejects executable MIME', () => {
    expect(() => assertMime('application/x-msdownload')).toThrow(/mime_not_allowed/);
  });
  it('rights block after expiry', () => {
    expect(rightsStatus('2020-01-01', '2026-09-07')).toBe('block');
    expect(rightsStatus('2026-09-12', '2026-09-07')).toBe('warn');
  });
});

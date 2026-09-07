import { CpAssetsService, assertMime, rightsStatus } from './cp-assets.service';

describe('CpAssetsService', () => {
  it('rejects executable MIME', () => {
    expect(() => assertMime('application/x-msdownload')).toThrow(/mime_not_allowed/);
  });
  it('rights block after expiry', () => {
    expect(rightsStatus('2020-01-01', '2026-09-07')).toBe('block');
    expect(rightsStatus('2026-09-12', '2026-09-07')).toBe('warn');
  });

  it('returns the rights fields needed to preserve edits', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new CpAssetsService({ query } as never);

    await service.listAssets({ scope: 'all', staffId: 1 });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('r.license_type');
    expect(sql).toContain('r.territory');
    expect(sql).toContain('r.model_release');
  });
});

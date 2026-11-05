import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';

function makeRepo(query: jest.Mock) {
  const repo = new ContentOsPortfolioRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

describe('ContentOsPortfolioRepository settings', () => {
  it('getSetting returns null when the row is missing', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.getSetting('direct_social_publish')).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/FROM cmkt_settings/),
      ['direct_social_publish'],
    );
  });

  it('getSetting returns null when the settings table is missing', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('relation "cmkt_settings" does not exist'), { code: '42P01' }));
    const repo = makeRepo(query);
    await expect(repo.getSetting('direct_social_publish')).resolves.toBeNull();
  });

  it('getSetting returns null when a cmkt_settings column is missing', async () => {
    const query = jest.fn().mockRejectedValue(
      Object.assign(new Error('column "value_json" of relation "cmkt_settings" does not exist'), {
        code: '42703',
        table: 'cmkt_settings',
      }),
    );
    const repo = makeRepo(query);
    await expect(repo.getSetting('direct_social_publish')).resolves.toBeNull();
  });

  it('getSetting throws when postgres is not ready instead of returning null', async () => {
    const query = jest.fn();
    const repo = makeRepo(query);
    Object.assign(repo, { pgReady: false });
    await expect(repo.getSetting('direct_social_publish')).rejects.toMatchObject({ status: 503 });
    expect(query).not.toHaveBeenCalled();
  });

  it('getSetting rethrows a real database error', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('too many connections'), { code: '53300' }));
    const repo = makeRepo(query);
    await expect(repo.getSetting('direct_social_publish')).rejects.toMatchObject({
      message: 'too many connections',
    });
  });

  it('upsertSetting persists value_json and getSetting reads it', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ key: 'direct_social_publish', value_json: true, updated_by: 'admin@ptt.vn' }],
    });
    const repo = makeRepo(query);
    const saved = await repo.upsertSetting('direct_social_publish', true, 'admin@ptt.vn');
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO cmkt_settings/),
      ['direct_social_publish', JSON.stringify(true), 'admin@ptt.vn'],
    );
    expect(saved).toEqual({ key: 'direct_social_publish', value_json: true });
    query.mockResolvedValueOnce({
      rows: [{ key: 'direct_social_publish', value_json: true }],
    });
    await expect(repo.getSetting('direct_social_publish')).resolves.toEqual({
      key: 'direct_social_publish',
      value_json: true,
    });
  });
});

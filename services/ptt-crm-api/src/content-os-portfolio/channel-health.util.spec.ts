import { pickConnectorPerChannel, resolveChannelHealth } from './channel-health.util';

describe('resolveChannelHealth', () => {
  const now = new Date('2026-09-11T04:00:00.000Z');

  it('returns Manual when no connector row exists', () => {
    expect(resolveChannelHealth(null, now)).toEqual({ status: 'Manual' });
    expect(resolveChannelHealth(undefined, now)).toEqual({ status: 'Manual' });
  });

  it('returns TokenExpired only when an enabled connector row has an expired token', () => {
    expect(
      resolveChannelHealth(
        { channel: 'facebook', enabled: true, expires_at: '2026-09-01T00:00:00.000Z' },
        now,
      ),
    ).toEqual({
      status: 'TokenExpired',
      expires_at: '2026-09-01T00:00:00.000Z',
    });
  });

  it('does not invent TokenExpired when the connector token is still valid', () => {
    expect(
      resolveChannelHealth(
        { channel: 'facebook', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
        now,
      ),
    ).toEqual({
      status: 'Connected',
      expires_at: '2026-12-01T00:00:00.000Z',
    });
  });

  it('treats an enabled connector without expiry as Connected, never a fake token date', () => {
    expect(resolveChannelHealth({ channel: 'linkedin', enabled: true }, now)).toEqual({
      status: 'Connected',
    });
  });

  it('returns Manual for a disabled or off connector even when a token date exists', () => {
    expect(
      resolveChannelHealth(
        { channel: 'facebook', enabled: false, expires_at: '2026-12-01T00:00:00.000Z' },
        now,
      ),
    ).toEqual({ status: 'Manual' });
    expect(
      resolveChannelHealth(
        { channel: 'linkedin', enabled: false, expires_at: '2020-01-01T00:00:00.000Z' },
        now,
      ),
    ).toEqual({ status: 'Manual' });
  });
});

describe('pickConnectorPerChannel', () => {
  it('picks the enabled row with the latest expiry, then the highest id', () => {
    const picked = pickConnectorPerChannel([
      { id: 9, channel: 'facebook', enabled: false, expires_at: '2027-01-01T00:00:00.000Z' },
      { id: 3, channel: 'facebook', enabled: true, expires_at: '2020-01-01T00:00:00.000Z' },
      { id: 8, channel: 'facebook', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
      { id: 12, channel: 'facebook', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
      { id: 2, channel: 'linkedin', enabled: true, expires_at: '2026-10-01T00:00:00.000Z' },
    ]);
    expect(picked.get('facebook')).toEqual({
      id: 12,
      channel: 'facebook',
      enabled: true,
      expires_at: '2026-12-01T00:00:00.000Z',
    });
    expect(picked.get('linkedin')?.id).toBe(2);
  });

  it('does not pick a disabled-only channel so health stays Manual', () => {
    const picked = pickConnectorPerChannel([
      { id: 9, channel: 'facebook', enabled: false, expires_at: '2027-01-01T00:00:00.000Z' },
      { id: 2, channel: 'linkedin', enabled: false },
    ]);
    expect(picked.has('facebook')).toBe(false);
    expect(picked.has('linkedin')).toBe(false);
  });
});

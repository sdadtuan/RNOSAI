import { isConnectorEnabled, pickConnectorPerChannel, resolveChannelHealth } from './channel-health.util';

describe('resolveChannelHealth', () => {
  const now = new Date('2026-09-11T04:00:00.000Z');

  it('returns Manual when no connector row exists', () => {
    expect(resolveChannelHealth(null, now)).toEqual({ status: 'Manual' });
    expect(resolveChannelHealth(undefined, now)).toEqual({ status: 'Manual' });
  });

  it('returns TokenExpired only when an enabled connector row has an expired token', () => {
    expect(
      resolveChannelHealth(
        { channel: 'facebook', status: 'on', enabled: true, expires_at: '2026-09-01T00:00:00.000Z' },
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
        { channel: 'facebook', status: 'on', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
        now,
      ),
    ).toEqual({
      status: 'Connected',
      expires_at: '2026-12-01T00:00:00.000Z',
    });
  });

  it('treats an enabled connector without expiry as Connected, never a fake token date', () => {
    expect(resolveChannelHealth({ channel: 'linkedin', status: 'on', enabled: true }, now)).toEqual({
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

  it("returns Manual when status is 'disabled' even if enabled was denylist-true", () => {
    expect(
      resolveChannelHealth(
        {
          channel: 'facebook',
          status: 'disabled',
          enabled: true,
          expires_at: '2026-12-01T00:00:00.000Z',
        },
        now,
      ),
    ).toEqual({ status: 'Manual' });
  });

  it('returns Manual when status is null or missing even if enabled is true', () => {
    expect(
      resolveChannelHealth(
        {
          channel: 'facebook',
          status: null,
          enabled: true,
          expires_at: '2026-12-01T00:00:00.000Z',
        },
        now,
      ),
    ).toEqual({ status: 'Manual' });
    expect(
      resolveChannelHealth(
        {
          channel: 'linkedin',
          enabled: true,
          expires_at: '2026-12-01T00:00:00.000Z',
        },
        now,
      ),
    ).toEqual({ status: 'Manual' });
  });
});

describe('isConnectorEnabled', () => {
  it("treats only status 'on' as enabled — enabled true is not a fallback", () => {
    expect(isConnectorEnabled({ status: 'on' })).toBe(true);
    expect(isConnectorEnabled({ status: 'on', enabled: false })).toBe(true);
    expect(isConnectorEnabled({ status: 'disabled' })).toBe(false);
    expect(isConnectorEnabled({ status: 'off' })).toBe(false);
    expect(isConnectorEnabled({ status: null })).toBe(false);
    expect(isConnectorEnabled({ enabled: false })).toBe(false);
    expect(isConnectorEnabled({ status: 'disabled', enabled: true })).toBe(false);
  });

  it('does not treat enabled true as a fallback when status is null or missing', () => {
    expect(isConnectorEnabled({ status: null, enabled: true })).toBe(false);
    expect(isConnectorEnabled({ enabled: true })).toBe(false);
  });
});

describe('pickConnectorPerChannel', () => {
  it('picks the enabled row with the latest expiry, then the highest id', () => {
    const picked = pickConnectorPerChannel([
      { id: 9, channel: 'facebook', enabled: false, expires_at: '2027-01-01T00:00:00.000Z' },
      { id: 3, channel: 'facebook', status: 'on', enabled: true, expires_at: '2020-01-01T00:00:00.000Z' },
      { id: 8, channel: 'facebook', status: 'on', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
      { id: 12, channel: 'facebook', status: 'on', enabled: true, expires_at: '2026-12-01T00:00:00.000Z' },
      { id: 2, channel: 'linkedin', status: 'on', enabled: true, expires_at: '2026-10-01T00:00:00.000Z' },
    ]);
    expect(picked.get('facebook')).toEqual({
      id: 12,
      channel: 'facebook',
      status: 'on',
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

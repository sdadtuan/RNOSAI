import { resolveChannelHealth } from './channel-health.util';

describe('resolveChannelHealth', () => {
  const now = new Date('2026-09-11T04:00:00.000Z');

  it('returns Manual when no connector row exists', () => {
    expect(resolveChannelHealth(null, now)).toEqual({ status: 'Manual' });
    expect(resolveChannelHealth(undefined, now)).toEqual({ status: 'Manual' });
  });

  it('returns TokenExpired only when a connector row has an expired token', () => {
    expect(
      resolveChannelHealth({ channel: 'facebook', expires_at: '2026-09-01T00:00:00.000Z' }, now),
    ).toEqual({
      status: 'TokenExpired',
      expires_at: '2026-09-01T00:00:00.000Z',
    });
  });

  it('does not invent TokenExpired when the connector token is still valid', () => {
    expect(
      resolveChannelHealth({ channel: 'facebook', expires_at: '2026-12-01T00:00:00.000Z' }, now),
    ).toEqual({
      status: 'Connected',
      expires_at: '2026-12-01T00:00:00.000Z',
    });
  });

  it('treats a connector without expiry as Connected, never a fake token date', () => {
    expect(resolveChannelHealth({ channel: 'linkedin' }, now)).toEqual({ status: 'Connected' });
  });
});

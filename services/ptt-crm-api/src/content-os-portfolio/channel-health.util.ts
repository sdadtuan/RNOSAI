export type ChannelHealthStatus = 'Manual' | 'TokenExpired' | 'Connected';

export type ChannelConnectorRow = {
  channel: string;
  expires_at?: string | null;
};

export type ChannelHealth = {
  status: ChannelHealthStatus;
  expires_at?: string;
};

export function resolveChannelHealth(
  connector: ChannelConnectorRow | null | undefined,
  now: Date = new Date(),
): ChannelHealth {
  if (!connector) return { status: 'Manual' };
  const raw = connector.expires_at;
  if (raw == null || String(raw).trim() === '') {
    return { status: 'Connected' };
  }
  const expires = new Date(raw);
  if (!Number.isFinite(expires.getTime())) {
    return { status: 'Connected' };
  }
  const expires_at = expires.toISOString();
  if (expires.getTime() <= now.getTime()) {
    return { status: 'TokenExpired', expires_at };
  }
  return { status: 'Connected', expires_at };
}

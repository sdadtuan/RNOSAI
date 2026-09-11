export type ChannelHealthStatus = 'Manual' | 'TokenExpired' | 'Connected';

export type ChannelConnectorRow = {
  id?: number;
  channel: string;
  expires_at?: string | null;
  enabled?: boolean;
};

export type ChannelHealth = {
  status: ChannelHealthStatus;
  expires_at?: string;
};

export function resolveChannelHealth(
  connector: ChannelConnectorRow | null | undefined,
  now: Date = new Date(),
): ChannelHealth {
  if (!connector || connector.enabled !== true) return { status: 'Manual' };
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

function connectorRank(row: ChannelConnectorRow): [number, number, number] {
  const enabled = row.enabled === true ? 1 : 0;
  const expiresMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.NEGATIVE_INFINITY;
  const id = typeof row.id === 'number' && Number.isFinite(row.id) ? row.id : Number.NEGATIVE_INFINITY;
  return [enabled, Number.isFinite(expiresMs) ? expiresMs : Number.NEGATIVE_INFINITY, id];
}

function isBetterConnector(candidate: ChannelConnectorRow, current: ChannelConnectorRow): boolean {
  const next = connectorRank(candidate);
  const prev = connectorRank(current);
  if (next[0] !== prev[0]) return next[0] > prev[0];
  if (next[1] !== prev[1]) return next[1] > prev[1];
  return next[2] > prev[2];
}

export function pickConnectorPerChannel(rows: ChannelConnectorRow[]): Map<string, ChannelConnectorRow> {
  const byChannel = new Map<string, ChannelConnectorRow>();
  for (const row of rows) {
    if (row.enabled !== true) continue;
    const channel = String(row.channel ?? '').trim();
    if (!channel) continue;
    const existing = byChannel.get(channel);
    if (!existing || isBetterConnector(row, existing)) {
      byChannel.set(channel, row);
    }
  }
  return byChannel;
}

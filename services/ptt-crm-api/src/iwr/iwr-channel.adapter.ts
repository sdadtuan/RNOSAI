export type IwrChannelPayload = {
  event: string;
  report_id: string | null;
  message?: string;
};

export type IwrChannelSendResult = {
  channel: 'slack' | 'teams' | 'zalo' | 'none';
  ok: boolean;
  skipped?: boolean;
};

export async function sendIwrChannelNotification(payload: IwrChannelPayload): Promise<IwrChannelSendResult[]> {
  const results: IwrChannelSendResult[] = [];
  const slack = process.env.PTT_IWR_SLACK_WEBHOOK?.trim();
  const teams = process.env.PTT_IWR_TEAMS_WEBHOOK?.trim();
  const zalo = process.env.PTT_IWR_ZALO_WEBHOOK?.trim();

  if (slack?.startsWith('https://')) {
    results.push(await postWebhook('slack', slack, payload));
  } else {
    results.push({ channel: 'slack', ok: true, skipped: true });
  }
  if (teams?.startsWith('https://')) {
    results.push(await postWebhook('teams', teams, payload));
  } else {
    results.push({ channel: 'teams', ok: true, skipped: true });
  }
  if (zalo?.startsWith('https://')) {
    results.push(await postWebhook('zalo', zalo, payload));
  } else {
    results.push({ channel: 'zalo', ok: true, skipped: true });
  }
  return results;
}

async function postWebhook(
  channel: 'slack' | 'teams' | 'zalo',
  url: string,
  payload: IwrChannelPayload,
): Promise<IwrChannelSendResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return { channel, ok: res.ok };
  } catch {
    return { channel, ok: false };
  }
}

import { sendIwrChannelNotification } from './iwr-channel.adapter';

describe('iwr-channel.adapter', () => {
  const origSlack = process.env.PTT_IWR_SLACK_WEBHOOK;
  const origTeams = process.env.PTT_IWR_TEAMS_WEBHOOK;
  const origZalo = process.env.PTT_IWR_ZALO_WEBHOOK;

  afterEach(() => {
    process.env.PTT_IWR_SLACK_WEBHOOK = origSlack;
    process.env.PTT_IWR_TEAMS_WEBHOOK = origTeams;
    process.env.PTT_IWR_ZALO_WEBHOOK = origZalo;
  });

  it('skips channels when webhooks unset', async () => {
    delete process.env.PTT_IWR_SLACK_WEBHOOK;
    delete process.env.PTT_IWR_TEAMS_WEBHOOK;
    delete process.env.PTT_IWR_ZALO_WEBHOOK;
    const out = await sendIwrChannelNotification({ event: 'webhook.test', report_id: null });
    expect(out.every((r) => r.skipped === true)).toBe(true);
  });
});

import { parseTikTokWebhook, parseTikTokWebhookPayload } from './tiktok-webhook.parser';

describe('parseTikTokWebhookPayload', () => {
  it('parses official entry/changes envelope', () => {
    const rows = parseTikTokWebhookPayload({
      object: 1,
      entry: [
        {
          id: 'lead-99',
          advertiser_id: 123456,
          page_id: 789,
          campaign_id: 'camp-1',
          changes: [
            { field: 'name', value: 'Jane Doe' },
            { field: 'phone_number', value: '0901234567' },
            { field: 'email', value: 'j@example.com' },
          ],
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('0901234567');
    expect(rows[0].full_name).toBe('Jane Doe');
    expect(rows[0].meta?.tiktok_lead_id).toBe('lead-99');
  });
});

describe('parseTikTokWebhook', () => {
  it('accepts payload when webhook key is not configured', () => {
    delete process.env.CRM_TIKTOK_WEBHOOK_KEY;
    const body = Buffer.from(JSON.stringify({ phone: '0901111222', full_name: 'T' }));
    const out = parseTikTokWebhook({ headers: {}, rawBody: body, clientId: 'c1' });
    expect(out.verified).toBe(true);
    expect(out.leads).toHaveLength(1);
  });
});

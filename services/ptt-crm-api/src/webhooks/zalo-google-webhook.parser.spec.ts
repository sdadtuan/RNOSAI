import { createHash, createHmac } from 'crypto';
import { parseGoogleWebhookPayload, parseGoogleWebhook } from './google-webhook.parser';
import { parseZaloWebhookPayload, parseZaloWebhook, verifyZaloSignature } from './zalo-webhook.parser';

describe('zalo-webhook.parser', () => {
  it('verifyZaloSignature accepts valid hmac', () => {
    const body = Buffer.from('{"event_name":"user_submit_info"}');
    const secret = 'zalo-secret';
    const digest = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyZaloSignature(body, digest, secret)).toBe(true);
  });

  it('parses user_submit_info payload', () => {
    const payload = {
      event_name: 'user_submit_info',
      app_id: '12345',
      oa_id: 'OA_001',
      user_id: 'U001',
      info: {
        name: 'Nguyen Van A',
        phone: '0901234567',
        campaign_id: 'ZALO_CAMP_01',
      },
    };
    const rows = parseZaloWebhookPayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Nguyen Van A');
    expect(rows[0].phone).toBe('0901234567');
    expect(rows[0].source).toBe('zalo');
  });

  it('parseZaloWebhook normalizes lead', () => {
    const payload = {
      event_name: 'user_submit_info',
      info: { name: 'A', phone: '090' },
    };
    const body = Buffer.from(JSON.stringify(payload));
    const out = parseZaloWebhook({
      headers: {},
      rawBody: body,
      clientId: 'client-zalo',
      config: { webhookSecret: '' },
    });
    expect(out.verified).toBe(true);
    expect(out.leads).toHaveLength(1);
    expect(out.leads[0].channel).toBe('zalo');
    expect(out.leads[0].client_id).toBe('client-zalo');
  });

  it('reads the OA id from recipient on the official user_submit_info envelope', () => {
    const rows = parseZaloWebhookPayload({
      sender: { id: 'USER1' },
      recipient: { id: 'OA_OFFICIAL' },
      event_name: 'user_submit_info',
      app_id: 'APP_SHOULD_NOT_BE_OA',
      timestamp: '1540368141908',
      info: {
        name: 'Name Example',
        phone: '84912345678',
        full_address: { user_city: 'Thành phố Hồ Chí Minh', user_address: 'Đường số 13' },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].oa_id).toBe('OA_OFFICIAL');
    expect(rows[0].full_name).toBe('Name Example');
    expect(rows[0].phone).toBe('84912345678');
    expect(rows[0].region).toContain('Hồ Chí Minh');
    expect(rows[0].meta?.user_id).toBe('USER1');
  });

  it('reads a numeric phone on user_submit_info', () => {
    const rows = parseZaloWebhookPayload({
      event_name: 'user_submit_info',
      sender: { id: 'USER1' },
      recipient: { id: 'OA1' },
      info: { name: 'Tú', phone: 84909699999 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('84909699999');
  });

  it('reads a phone written inside a chat message', () => {
    const rows = parseZaloWebhookPayload({
      event_name: 'user_send_text',
      sender: { id: 'USER1' },
      recipient: { id: 'OA1' },
      message: { text: 'Số điện thoại: 0909699999' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('0909699999');
  });

  it('does not turn a chat message into a lead', () => {
    const rows = parseZaloWebhookPayload({
      event_name: 'user_send_text',
      app_id: 'APP1',
      sender: { id: 'USER1' },
      recipient: { id: 'OA1' },
      message: { text: 'xin chào', msg_id: 'm1' },
      timestamp: '1',
    });
    expect(rows).toHaveLength(0);
  });

  it('accepts the official X-ZEvent-Signature', () => {
    const payload = {
      event_name: 'user_submit_info',
      app_id: 'APP1',
      timestamp: '1540368141908',
      sender: { id: 'USER1' },
      recipient: { id: 'OA1' },
      info: { name: 'A', phone: '090' },
    };
    const body = Buffer.from(JSON.stringify(payload));
    const secret = 'oa-secret';
    const mac = createHash('sha256').update('APP1').update(body).update('1540368141908').update(secret).digest('hex');
    const out = parseZaloWebhook({
      headers: { 'x-zevent-signature': `mac=${mac}` },
      rawBody: body,
      clientId: 'client-zalo',
      config: { webhookSecret: secret },
    });
    expect(out.verified).toBe(true);
    expect(out.leads[0]?.contact.phone).toBe('090');
  });

  it('accepts a signature made with the app secret when the OA secret does not match', () => {
    const payload = {
      event_name: 'user_submit_info',
      app_id: 'APP1',
      timestamp: '1540368141908',
      info: { name: 'A', phone: '0909699999' },
    };
    const body = Buffer.from(JSON.stringify(payload));
    const mac = createHash('sha256').update('APP1').update(body).update('1540368141908').update('app-secret').digest('hex');
    const out = parseZaloWebhook({
      headers: { 'x-zevent-signature': `mac=${mac}` },
      rawBody: body,
      clientId: 'client-zalo',
      config: { webhookSecret: 'oa-secret', alternateSecrets: ['app-secret'] },
    });
    expect(out.verified).toBe(true);
    expect(out.leads[0]?.contact.phone).toBe('0909699999');
  });

  it('names the signature failure when the mac does not match', () => {
    const body = Buffer.from(JSON.stringify({ event_name: 'user_submit_info', app_id: 'APP1', timestamp: '1', info: { phone: '090' } }));
    const out = parseZaloWebhook({
      headers: { 'x-zevent-signature': `mac=${'a'.repeat(64)}` },
      rawBody: body,
      clientId: 'client-zalo',
      config: { webhookSecret: 'oa-secret' },
    });
    expect(out.verified).toBe(false);
    expect(out.reject_reason).toBe('Invalid Zalo signature (mismatch)');
  });
});

describe('google-webhook.parser', () => {
  it('parses direct lead payload', () => {
    const rows = parseGoogleWebhookPayload({
      full_name: 'Google Lead',
      phone: '0909999888',
      email: 'g@test.local',
      meta: { google_lead_id: 'gl-1' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Google Lead');
  });

  it('parses user_column_data lead form payload', () => {
    const rows = parseGoogleWebhookPayload({
      lead_id: 'lead-123',
      campaign_id: '999',
      form_id: '555',
      user_column_data: [
        { column_name: 'Full Name', string_value: 'Test User' },
        { column_name: 'User Phone', string_value: '0901111222' },
        { column_name: 'User Email', string_value: 'a@example.com' },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Test User');
    expect(rows[0].meta?.google_lead_id).toBe('lead-123');
  });

  it('parseGoogleWebhook rejects invalid key when configured', () => {
    const body = Buffer.from(JSON.stringify({ google_key: 'wrong', full_name: 'X' }));
    const out = parseGoogleWebhook({
      headers: {},
      rawBody: body,
      clientId: 'c1',
      config: { leadWebhookKey: 'expected-key' },
    });
    expect(out.verified).toBe(false);
    expect(out.reject_reason).toBe('Invalid Google webhook key');
  });
});

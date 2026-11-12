import { createHmac } from 'node:crypto';
import { parsePortalMetaMessagingPayload } from './portal-meta-webhook.parser';
import { verifyFacebookSignature } from '../webhooks/meta-webhook.parser';
import { verifyMetaHubSubscribe } from './portal-inbox-poller.util';

const PAGE_ID = '1222371747615610';
const USER_PSID = 'user-psid-1';

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('parsePortalMetaMessagingPayload', () => {
  it('parses inbound messages and echoes as outbound', () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: USER_PSID, name: 'Tu Huynh' },
              recipient: { id: PAGE_ID },
              timestamp: 1762923709000,
              message: { mid: 'm_in_1', text: 'test' },
            },
            {
              sender: { id: PAGE_ID },
              recipient: { id: USER_PSID },
              timestamp: 1762923720000,
              message: {
                mid: 'm_out_1',
                text: 'PTT Advertising Solutions xin chào! Đây là tin nhắn trả lời test.',
                is_echo: true,
              },
            },
          ],
        },
      ],
    };
    const out = parsePortalMetaMessagingPayload(payload);
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0].message).toMatchObject({
      external_id: 'm_in_1',
      sender_name: 'Tu Huynh',
      sender_psid: USER_PSID,
      body: 'test',
      direction: 'in',
    });
    expect(out.messages[1].message).toMatchObject({
      external_id: 'm_out_1',
      sender_psid: USER_PSID,
      direction: 'out',
    });
    expect(out.comments).toHaveLength(0);
    expect(out.leadHints).toHaveLength(0);
  });

  it('parses messaging_postbacks as inbound messages', () => {
    const out = parsePortalMetaMessagingPayload({
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: USER_PSID, name: 'Tu Huynh' },
              recipient: { id: PAGE_ID },
              timestamp: 1762923730000,
              postback: { title: 'Nhận tư vấn', payload: 'CONSULT', mid: 'm_pb_1' },
            },
          ],
        },
      ],
    });
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].message).toMatchObject({
      external_id: 'm_pb_1',
      body: 'Nhận tư vấn',
      direction: 'in',
      sender_psid: USER_PSID,
    });
  });

  it('parses feed comments', () => {
    const out = parsePortalMetaMessagingPayload({
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          changes: [
            {
              field: 'feed',
              value: {
                item: 'comment',
                verb: 'add',
                comment_id: 'c_1',
                post_id: 'p_1',
                parent_id: 'p_1',
                created_time: 1762923740,
                from: { id: USER_PSID, name: 'Tu Huynh' },
                message: 'Cho hỏi giá ạ',
              },
            },
          ],
        },
      ],
    });
    expect(out.comments).toHaveLength(1);
    expect(out.comments[0].comment).toMatchObject({
      comment_id: 'c_1',
      post_id: 'p_1',
      from_name: 'Tu Huynh',
      message: 'Cho hỏi giá ạ',
    });
  });

  it('parses leadgen hints without fetching Graph', () => {
    const out = parsePortalMetaMessagingPayload({
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          changes: [
            {
              field: 'leadgen',
              value: { leadgen_id: 'l_99', form_id: 'f_1', page_id: PAGE_ID },
            },
          ],
        },
      ],
    });
    expect(out.leadHints).toEqual([{ page_id: PAGE_ID, leadgen_id: 'l_99', form_id: 'f_1' }]);
    expect(out.messages).toHaveLength(0);
  });

  it('is idempotent for the same mid across two payloads', () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: USER_PSID },
              recipient: { id: PAGE_ID },
              timestamp: 1762923709000,
              message: { mid: 'm_dup', text: 'hello' },
            },
          ],
        },
      ],
    };
    const first = parsePortalMetaMessagingPayload(payload);
    const second = parsePortalMetaMessagingPayload(payload);
    expect(first.messages[0].message.external_id).toBe('m_dup');
    expect(second.messages[0].message.external_id).toBe('m_dup');
  });
});

describe('webhook signature and GET verify helpers', () => {
  it('accepts a valid X-Hub-Signature-256 over the raw body', () => {
    const body = '{"object":"page","entry":[]}';
    const secret = 'test-app-secret';
    const header = sign(body, secret);
    expect(verifyFacebookSignature(Buffer.from(body), header, [secret])).toBe(true);
    expect(verifyFacebookSignature(Buffer.from(body), header, ['other'])).toBe(false);
  });

  it('verifies hub.subscribe challenge', () => {
    const ok = verifyMetaHubSubscribe(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': 'abc' },
      'tok',
    );
    expect(ok).toEqual({ ok: true, challenge: 'abc' });
    const bad = verifyMetaHubSubscribe(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': 'abc' },
      'tok',
    );
    expect(bad.ok).toBe(false);
  });
});

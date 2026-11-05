import { resolveConversationProject, parseZaloConversationEvents } from './b2b-conversations.util';

describe('resolveConversationProject', () => {
  const catalog = {
    forms: [],
    pages: [],
    accounts: [
      { channel: 'zalo' as const, externalKey: 'OA1', projectId: 'p1', projectSlug: 'seo', active: true },
    ],
  };

  it('maps oa to project', () => {
    expect(resolveConversationProject({ oaId: 'OA1', projectSlug: 'seo', catalog })).toEqual({
      projectId: 'p1',
    });
  });

  it('slug mismatch → không gắn thread', () => {
    expect(resolveConversationProject({ oaId: 'OA1', projectSlug: 'other', catalog })).toEqual({
      attach: false,
      reason: 'slug_mismatch',
    });
  });
});

describe('parseZaloConversationEvents', () => {
  it('parses user_send_text', () => {
    const events = parseZaloConversationEvents({
      event_name: 'user_send_text',
      oa_id: 'OA1',
      user_id: 'U99',
      info: { text: 'Xin chào' },
    });
    expect(events).toEqual([
      expect.objectContaining({
        oaId: 'OA1',
        userId: 'U99',
        body: 'Xin chào',
        direction: 'inbound',
      }),
    ]);
  });

  it('parses the official sender/recipient envelope', () => {
    const events = parseZaloConversationEvents({
      app_id: 'APP_NOT_OA',
      sender: { id: 'USER9' },
      recipient: { id: 'OA9' },
      event_name: 'user_send_text',
      message: { text: 'cần báo giá', msg_id: 'm9' },
      timestamp: '1',
    });
    expect(events).toEqual([
      expect.objectContaining({
        oaId: 'OA9',
        userId: 'USER9',
        body: 'cần báo giá',
        direction: 'inbound',
        providerMessageId: 'm9',
      }),
    ]);
  });
});

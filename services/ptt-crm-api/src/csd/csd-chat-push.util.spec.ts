import { chatPushNotice } from './csd-chat-push.util';

describe('chatPushNotice', () => {
  it('truncates the preview and never carries a password field', () => {
    const notice = chatPushNotice({
      title: 'Lan',
      preview: 'x'.repeat(200),
      conversationId: 'conv-1',
    });
    expect(notice.title).toBe('Lan');
    expect(notice.body).toHaveLength(120);
    expect(notice.conversationId).toBe('conv-1');
    expect(notice).not.toHaveProperty('password');
    expect(notice).not.toHaveProperty('access_token');
  });

  it('uses a file placeholder when the body is empty', () => {
    expect(chatPushNotice({ title: '', preview: '   ', conversationId: 'c' }).body).toBe('(file)');
    expect(chatPushNotice({ title: '', preview: '', conversationId: 'c' }).title).toBe('PTT');
  });
});

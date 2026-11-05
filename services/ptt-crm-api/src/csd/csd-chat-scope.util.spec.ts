import { isChatScopedPath } from './csd-chat-scope.util';

describe('isChatScopedPath', () => {
  it('allows chat conversation and summary routes', () => {
    expect(isChatScopedPath('/api/crm/csd/chat/session')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/conversations/abc/messages')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/ai/conversations/abc/summarize')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/files/abc')).toBe(true);
  });

  it('blocks admin, email, and the rest of CRM', () => {
    expect(isChatScopedPath('/api/crm/csd/admin/chat-accounts')).toBe(false);
    expect(isChatScopedPath('/api/crm/csd/emails/send')).toBe(false);
    expect(isChatScopedPath('/api/crm/leads')).toBe(false);
    expect(isChatScopedPath('/api/crm/csd/chat-evil')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { detectCsdChatShell } from './csd-chat-shell';

describe('detectCsdChatShell', () => {
  it('keeps the CRM chrome on a normal chat URL', () => {
    expect(detectCsdChatShell({ search: '' })).toBe('crm');
  });

  it('treats shell=desktop as the desktop window', () => {
    expect(detectCsdChatShell({ search: '?shell=desktop&c=abc' })).toBe('desktop');
  });

  it('treats an installed home-screen launch as the phone PWA', () => {
    expect(detectCsdChatShell({ search: '', displayMode: 'standalone' })).toBe('pwa');
    expect(detectCsdChatShell({ search: '', iosStandalone: true })).toBe('pwa');
    expect(detectCsdChatShell({ search: '?shell=pwa' })).toBe('pwa');
  });

  it('lets an explicit desktop query win over standalone', () => {
    expect(detectCsdChatShell({ search: '?shell=desktop', displayMode: 'standalone' })).toBe('desktop');
  });
});

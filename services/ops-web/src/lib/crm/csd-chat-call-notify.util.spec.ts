import { describe, expect, it } from 'vitest';
import {
  csdChatCallNotifyTag,
  csdChatMessageNotifyTag,
  csdIncomingCallNotifyCopy,
  shouldAlertIncomingCsdCall,
} from './csd-chat-call-notify.util';

describe('csd-chat-call-notify.util', () => {
  it('builds distinct tags for message vs call', () => {
    expect(csdChatMessageNotifyTag('c1', 't1')).toBe('csd-chat:c1:t1');
    expect(csdChatCallNotifyTag('staff_9')).toBe('csd-call:staff_9');
  });

  it('alerts when permission allows and not busy', () => {
    expect(shouldAlertIncomingCsdCall({ permission: 'granted', alreadyBusy: false })).toBe(true);
    expect(shouldAlertIncomingCsdCall({ permission: 'default', alreadyBusy: false })).toBe(true);
    expect(shouldAlertIncomingCsdCall({ permission: 'denied', alreadyBusy: false })).toBe(false);
    expect(shouldAlertIncomingCsdCall({ permission: 'granted', alreadyBusy: true })).toBe(false);
  });

  it('formats incoming call notification copy', () => {
    expect(csdIncomingCallNotifyCopy({ peerName: 'An', isVideo: false })).toEqual({
      title: 'Cuộc gọi thoại đến',
      preview: 'An',
    });
    expect(csdIncomingCallNotifyCopy({ peerName: '', isVideo: true }).title).toMatch(/video/i);
  });
});

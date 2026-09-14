import {
  csdChatCallNotifyTag,
  csdChatMessageNotifyTag,
} from './csd-chat-notify-persist';

/** Whether to fire OS notification + ring for an incoming call. */
export function shouldAlertIncomingCsdCall(input: {
  permission: NotificationPermission | 'unsupported';
  alreadyBusy: boolean;
}): boolean {
  if (input.alreadyBusy) return false;
  return input.permission === 'granted' || input.permission === 'default';
}

export function csdIncomingCallNotifyCopy(input: {
  peerName: string;
  isVideo: boolean;
}): { title: string; preview: string } {
  const peer = input.peerName.trim() || 'Đồng nghiệp';
  return {
    title: input.isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến',
    preview: peer,
  };
}

export { csdChatCallNotifyTag, csdChatMessageNotifyTag };

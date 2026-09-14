'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CSD_CHAT_NEED_NOTIFY_PERMISSION_EVENT,
  csdNotifyPermissionPromptKind,
  shouldShowCsdNotifyPermissionPrompt,
  writeCsdNotifyPermissionDismissed,
  clearCsdNotifyPermissionDismissed,
} from '@/lib/crm/csd-chat-notify-permission.util';
import {
  notificationPermission,
  requestCsdChatNotifyPermission,
} from '@/lib/crm/csd-chat-notify-persist';

type CsdChatNotifyPermissionPromptProps = {
  enabled: boolean;
};

export function CsdChatNotifyPermissionPrompt({ enabled }: CsdChatNotifyPermissionPromptProps) {
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window === 'undefined' ? 'unsupported' : notificationPermission(),
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback((force = false) => {
    const next = notificationPermission();
    setPermission(next);
    setVisible(shouldShowCsdNotifyPermissionPrompt({ permission: next, force }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    refresh(false);
    const onNeed = () => refresh(true);
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh(false);
    };
    window.addEventListener(CSD_CHAT_NEED_NOTIFY_PERMISSION_EVENT, onNeed);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(CSD_CHAT_NEED_NOTIFY_PERMISSION_EVENT, onNeed);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, refresh]);

  async function enable() {
    setBusy(true);
    try {
      const result = await requestCsdChatNotifyPermission();
      setPermission(result);
      if (result === 'granted') {
        clearCsdNotifyPermissionDismissed();
        setVisible(false);
      } else {
        setVisible(true);
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    writeCsdNotifyPermissionDismissed();
    setVisible(false);
  }

  if (!enabled || !visible) return null;

  const kind = csdNotifyPermissionPromptKind(permission);
  if (kind === 'hidden') return null;

  return (
    <div
      className="csd-chat-notify-permission"
      role="status"
      data-testid="csd-chat-notify-permission"
      data-kind={kind}
    >
      <div className="csd-chat-notify-permission__copy">
        <strong>
          {kind === 'ask' ? 'Bật thông báo trình duyệt' : 'Thông báo đang bị chặn'}
        </strong>
        <span>
          {kind === 'ask'
            ? 'Cho phép thông báo để nhận tin nhắn và cuộc gọi khi bạn đang ở tab khác hoặc thu nhỏ trình duyệt.'
            : 'Bạn đã chặn thông báo. Mở biểu tượng ổ khóa trên thanh địa chỉ → Quyền trang web → Thông báo → Cho phép, rồi tải lại trang.'}
        </span>
      </div>
      <div className="csd-chat-notify-permission__actions">
        {kind === 'ask' ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy}
            data-testid="csd-chat-notify-permission-enable"
            onClick={() => void enable()}
          >
            {busy ? 'Đang mở…' : 'Cho phép thông báo'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          data-testid="csd-chat-notify-permission-dismiss"
          onClick={dismiss}
        >
          Để sau
        </button>
      </div>
    </div>
  );
}

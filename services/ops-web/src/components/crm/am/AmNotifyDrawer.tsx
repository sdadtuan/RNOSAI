'use client';

import { useRouter } from 'next/navigation';
import { markAmNotificationRead, type AmNotificationItem } from '@/lib/crm/am-api';
import { amNotifyKindLabel } from '@/lib/crm/am-notify.util';

type AmNotifyDrawerProps = {
  open: boolean;
  items: AmNotificationItem[];
  token: string;
  onClose: () => void;
  onMarked?: () => void;
};

export function AmNotifyDrawer({ open, items, token, onClose, onMarked }: AmNotifyDrawerProps) {
  const router = useRouter();

  if (!open) return null;

  async function onSelect(item: AmNotificationItem) {
    if (token) {
      try {
        await markAmNotificationRead(token, item.id);
        onMarked?.();
      } catch {
        /* still navigate */
      }
    }
    onClose();
    if (item.href) router.push(item.href);
  }

  return (
    <div className="am-bell__panel" role="dialog" aria-label="Thông báo Account Management">
      <div className="am-bell__head">
        <strong>Thông báo</strong>
        <button type="button" className="am-btn" onClick={onClose}>
          Đóng
        </button>
      </div>
      <ul className="am-bell__list">
        {items.length ? (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`am-bell__item${item.read_at ? '' : ' am-bell__item--unread'}`}
                onClick={() => void onSelect(item)}
              >
                <span className="am-bell__kind">{amNotifyKindLabel(item.kind)}</span>
                <span>{item.title}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="muted">Không có thông báo.</li>
        )}
      </ul>
    </div>
  );
}

'use client';

import type { CsdDockTab } from '@/lib/crm/csd-chat-dock-persist';

type CsdChatTabsProps = {
  tab: CsdDockTab;
  incomingCount?: number;
  variant?: 'rail' | 'bar';
  onChange: (tab: CsdDockTab) => void;
};

export function CsdChatTabs({ tab, incomingCount = 0, variant = 'bar', onChange }: CsdChatTabsProps) {
  return (
    <div className={`csd-chat-tabs csd-chat-tabs--${variant}`} role="tablist" aria-label="Chat">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'messages'}
        className={tab === 'messages' ? 'is-active' : ''}
        data-testid="csd-chat-tab-messages"
        onClick={() => onChange('messages')}
      >
        <span className="csd-chat-tab-ico csd-chat-tab-ico--msg" aria-hidden />
        Tin nhắn
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'contacts'}
        className={tab === 'contacts' ? 'is-active' : ''}
        data-testid="csd-chat-tab-contacts"
        onClick={() => onChange('contacts')}
      >
        <span className="csd-chat-tab-ico csd-chat-tab-ico--people" aria-hidden />
        Danh bạ
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'requests'}
        className={tab === 'requests' ? 'is-active' : ''}
        data-testid="csd-chat-tab-requests"
        onClick={() => onChange('requests')}
      >
        <span className="csd-chat-tab-ico csd-chat-tab-ico--mail" aria-hidden />
        Lời mời{incomingCount > 0 ? ` (${incomingCount})` : ''}
      </button>
    </div>
  );
}

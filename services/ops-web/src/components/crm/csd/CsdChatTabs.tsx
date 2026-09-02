'use client';

import type { CsdDockTab } from '@/lib/crm/csd-chat-dock-persist';

type CsdChatTabsProps = {
  tab: CsdDockTab;
  incomingCount?: number;
  onChange: (tab: CsdDockTab) => void;
};

export function CsdChatTabs({ tab, incomingCount = 0, onChange }: CsdChatTabsProps) {
  return (
    <div className="csd-chat-tabs" role="tablist" aria-label="Chat">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'messages'}
        className={`btn btn-sm btn-secondary${tab === 'messages' ? ' is-active' : ''}`}
        data-testid="csd-chat-tab-messages"
        onClick={() => onChange('messages')}
      >
        Tin nhắn
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'contacts'}
        className={`btn btn-sm btn-secondary${tab === 'contacts' ? ' is-active' : ''}`}
        data-testid="csd-chat-tab-contacts"
        onClick={() => onChange('contacts')}
      >
        Danh bạ
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'requests'}
        className={`btn btn-sm btn-secondary${tab === 'requests' ? ' is-active' : ''}`}
        data-testid="csd-chat-tab-requests"
        onClick={() => onChange('requests')}
      >
        Lời mời{incomingCount > 0 ? ` (${incomingCount})` : ''}
      </button>
    </div>
  );
}

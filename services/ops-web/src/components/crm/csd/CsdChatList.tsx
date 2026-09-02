'use client';

import { useEffect, useState } from 'react';
import { type CsdConversationListFilter, type CsdConversationRow } from '@/lib/crm/csd-api';
import { avatarHue, formatChatListTime, initialsFromName } from '@/lib/crm/csd-chat-display';

const PRIMARY_FILTERS: { id: Exclude<CsdConversationListFilter, 'mentions'>; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
];

const KIND_FILTERS: { id: Exclude<CsdConversationListFilter, 'mentions'>; label: string }[] = [
  { id: 'clients', label: 'Khách' },
  { id: 'projects', label: 'Dự án' },
  { id: 'internal', label: 'Nội bộ' },
];

type CsdChatListProps = {
  conversations: CsdConversationRow[];
  activeId: string | null;
  filter: CsdConversationListFilter;
  canWrite: boolean;
  busy: boolean;
  error: string;
  search: string;
  onSearch: (value: string) => void;
  onFilter: (filter: CsdConversationListFilter) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCreateGroup: () => void;
};

export function CsdChatList({
  conversations,
  activeId,
  filter,
  canWrite,
  busy,
  error,
  search,
  onSearch,
  onFilter,
  onSelect,
  onNew,
  onCreateGroup,
}: CsdChatListProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(localSearch), 300);
    return () => window.clearTimeout(timer);
  }, [localSearch, onSearch]);

  return (
    <aside className="csd-chat-workspace__list">
      <div className="csd-chat-workspace__list-head">
        <label className="csd-chat-search">
          <span className="csd-chat-search__icon" aria-hidden>
            ⌕
          </span>
          <input
            placeholder="Tìm kiếm"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            data-testid="csd-chat-search"
          />
        </label>
        {canWrite ? (
          <div className="csd-chat-list-actions">
            <button type="button" className="csd-chat-icon-btn" disabled={busy} onClick={onNew}>
              Mới
            </button>
            <button
              type="button"
              className="csd-chat-icon-btn csd-chat-icon-btn--glyph"
              disabled={busy}
              onClick={onCreateGroup}
              aria-label="Tạo nhóm"
              title="Tạo nhóm"
              data-testid="csd-chat-create-group"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  fill="currentColor"
                  d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-1a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM3.5 18.2c.4-2.9 3-4.7 5.5-4.7s5.1 1.8 5.5 4.7c.1.6-.4 1.3-1 1.3H4.5c-.6 0-1.1-.7-1-1.3Zm10.2.3c.4-1.5 1.4-2.7 2.8-3.4.5-.1 1-.2 1.5-.2 1.9 0 3.6 1 4.3 2.6.2.5-.2 1.1-.8 1.1h-7.2c-.5 0-.8-.6-.6-1.1ZM19 8h1.25V6.75h1.5V8H23v1.5h-1.25V10.75h-1.5V9.5H19V8Z"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div className="csd-chat-filters">
        <div className="csd-chat-filters__tabs">
          {PRIMARY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'is-active' : ''}
              data-testid={`csd-chat-filter-${item.id}`}
              onClick={() => onFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="csd-chat-filters__kinds" aria-label="Phân loại">
          <span className="csd-chat-filters__kinds-label">Phân loại</span>
          {KIND_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'is-active' : ''}
              data-testid={`csd-chat-filter-${item.id}`}
              onClick={() => onFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <ul className="csd-chat-list" data-testid="csd-chat-list">
        {conversations.length === 0 ? (
          <li className="muted">Chưa có hội thoại</li>
        ) : (
          conversations.map((c) => {
            const unread = c.unread_count ?? 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`csd-chat-list__item${activeId === c.id ? ' is-active' : ''}${
                    c.has_p1_or_complaint ? ' is-risk' : ''
                  }`}
                  onClick={() => onSelect(c.id)}
                >
                  <span
                    className="csd-chat-avatar csd-chat-avatar--list"
                    style={{ background: `hsl(${avatarHue(c.id)} 55% 42%)` }}
                    aria-hidden
                  >
                    {initialsFromName(c.name_vi)}
                  </span>
                  <span className="csd-chat-list__body">
                    <span className="csd-chat-list__title">
                      <strong>{c.name_vi}</strong>
                      <span className="csd-chat-list__time">{formatChatListTime(c.last_message_at)}</span>
                    </span>
                    <span className="csd-chat-list__meta">
                      {c.preview ? <span className="csd-chat-list__preview">{c.preview}</span> : <span />}
                      {unread > 0 ? <span className="csd-chat-list__unread">{unread}</span> : null}
                    </span>
                    {c.status === 'closed' ? <span className="csd-chat-list__closed">Đã đóng</span> : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

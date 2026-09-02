'use client';

import { useEffect, useState } from 'react';
import {
  formatCsdWhen,
  type CsdConversationListFilter,
  type CsdConversationRow,
} from '@/lib/crm/csd-api';

const FILTERS: { id: Exclude<CsdConversationListFilter, 'mentions'>; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
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
    <aside className="csd-chat-workspace__list page-card">
      <div className="csd-chat-workspace__list-head">
        <h3 className="kpi-section-title">Hội thoại</h3>
        {canWrite ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onNew}>
            Mới
          </button>
        ) : null}
      </div>
      <input
        className="kpi-input"
        placeholder="Tìm hội thoại hoặc tin…"
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        data-testid="csd-chat-search"
      />
      <div className="csd-chat-filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm btn-secondary${filter === item.id ? ' is-active' : ''}`}
            data-testid={`csd-chat-filter-${item.id}`}
            onClick={() => onFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
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
                  <span className="csd-chat-list__title">
                    <strong>{c.name_vi}</strong>
                    {unread > 0 ? <span className="csd-chat-list__unread">{unread}</span> : null}
                  </span>
                  {c.preview ? <span className="csd-chat-list__preview muted">{c.preview}</span> : null}
                  <span className="muted">
                    {c.status === 'closed' ? 'Đã đóng · ' : ''}
                    {formatCsdWhen(c.last_message_at)}
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

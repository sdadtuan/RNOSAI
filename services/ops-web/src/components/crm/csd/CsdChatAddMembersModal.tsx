'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchCsdChatFriends,
  fetchCsdChatPeople,
  type CsdChatPersonRow,
  type CsdConversationMemberRow,
} from '@/lib/crm/csd-api';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import { resolveCsdPersonAvatar } from '@/lib/crm/csd-chat-display';

type MemberFilter = 'all' | 'friends';

type CsdChatAddMembersModalProps = {
  token: string;
  open: boolean;
  busy: boolean;
  members: CsdConversationMemberRow[];
  onClose: () => void;
  onConfirm: (staffIds: number[]) => Promise<boolean> | boolean;
};

function letterKey(name: string): string {
  const ch = name.trim().charAt(0).toLocaleUpperCase('vi-VN');
  return ch || '#';
}

function mergePeople(base: CsdChatPersonRow[], extra: CsdChatPersonRow[]): CsdChatPersonRow[] {
  const seen = new Set(base.map((p) => p.staff_id));
  const out = [...base];
  for (const person of extra) {
    if (seen.has(person.staff_id)) continue;
    seen.add(person.staff_id);
    out.push(person);
  }
  return out.sort((a, b) => a.display_name_vi.localeCompare(b.display_name_vi, 'vi'));
}

export function CsdChatAddMembersModal({
  token,
  open,
  busy,
  members,
  onClose,
  onConfirm,
}: CsdChatAddMembersModalProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [friends, setFriends] = useState<CsdChatPersonRow[]>([]);
  const [searchHits, setSearchHits] = useState<CsdChatPersonRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState('');

  const memberIds = useMemo(() => new Set(members.map((m) => m.member_staff_id)), [members]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter('all');
    setSelectedIds(new Set());
    setSearchHits([]);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    void fetchCsdChatFriends(token)
      .then((out) => {
        if (!cancelled) setFriends(out.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open || !token) return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchCsdChatPeople(token, q)
        .then((out) => {
          if (!cancelled) setSearchHits(out.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setSearchHits([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, token, query]);

  const roster = useMemo(() => {
    if (query.trim().length >= 2) return mergePeople([], searchHits);
    if (filter === 'friends') return friends;
    return friends;
  }, [friends, filter, query, searchHits]);

  const grouped = useMemo(() => {
    const map = new Map<string, CsdChatPersonRow[]>();
    for (const person of roster) {
      const key = letterKey(person.display_name_vi);
      const bucket = map.get(key) ?? [];
      bucket.push(person);
      map.set(key, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'vi'));
  }, [roster]);

  const newSelectedCount = [...selectedIds].filter((id) => !memberIds.has(id)).length;

  function togglePerson(person: CsdChatPersonRow) {
    if (memberIds.has(person.staff_id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(person.staff_id)) next.delete(person.staff_id);
      else next.add(person.staff_id);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="csd-modal-backdrop csd-chat-add-members-backdrop" data-testid="csd-chat-add-members-modal" onClick={onClose}>
      <div
        className="csd-chat-add-members"
        role="dialog"
        aria-modal="true"
        aria-label="Thêm thành viên"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="csd-chat-add-members__head">
          <h3>Thêm thành viên</h3>
          <button type="button" className="csd-chat-icon-btn" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="csd-chat-search csd-chat-add-members__search">
          <span className="csd-chat-search__icon" aria-hidden>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên người cần thêm"
            data-testid="csd-chat-add-members-search"
            autoFocus
          />
        </label>

        <div className="csd-chat-create-group__chips" role="tablist" aria-label="Lọc danh bạ">
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'friends', label: 'Bạn bè' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'is-active' : ''}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="csd-chat-add-members__body">
          {roster.length === 0 ? (
            <p className="muted">
              {friends.length === 0
                ? 'Chưa có bạn. Vào tab Danh bạ để gửi lời mời.'
                : 'Không tìm thấy người phù hợp.'}
            </p>
          ) : (
            grouped.map(([letter, people]) => (
              <div key={letter} className="csd-chat-add-members__section">
                <div className="csd-chat-add-members__letter">{letter}</div>
                <ul>
                  {people.map((person) => {
                    const joined = memberIds.has(person.staff_id);
                    const checked = joined || selectedIds.has(person.staff_id);
                    return (
                      <li key={person.staff_id}>
                        <button
                          type="button"
                          className={`csd-chat-add-members__person${checked ? ' is-checked' : ''}${
                            joined ? ' is-joined' : ''
                          }`}
                          data-testid={`csd-chat-add-members-person-${person.staff_id}`}
                          disabled={joined}
                          onClick={() => togglePerson(person)}
                        >
                          <span className={`csd-chat-add-members__check${checked ? ' is-on' : ''}`} aria-hidden>
                            {checked ? '✓' : ''}
                          </span>
                          <CsdChatAvatar
                            token={token}
                            name={person.display_name_vi}
                            {...resolveCsdPersonAvatar(person)}
                            className="csd-chat-avatar csd-chat-avatar--list"
                          />
                          <span className="csd-chat-add-members__person-meta">
                            <strong>{person.display_name_vi}</strong>
                            {joined ? <em>Đã tham gia</em> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <footer className="csd-chat-add-members__foot">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="csd-chat-add-members-confirm"
            disabled={busy || newSelectedCount === 0}
            onClick={() => {
              void (async () => {
                setError('');
                const ids = [...selectedIds].filter((id) => !memberIds.has(id));
                const ok = await onConfirm(ids);
                if (!ok) setError('Thêm thành viên thất bại');
              })();
            }}
          >
            Xác nhận{newSelectedCount > 0 ? ` (${newSelectedCount})` : ''}
          </button>
        </footer>
      </div>
    </div>
  );
}

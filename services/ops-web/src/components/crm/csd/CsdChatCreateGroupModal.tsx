'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchCsdChatFriends,
  fetchCsdChatPeople,
  type CsdChatPersonRow,
  type CreateCsdConversationInput,
} from '@/lib/crm/csd-api';
import { avatarHue, initialsFromName } from '@/lib/crm/csd-chat-display';

const MAX_MEMBERS = 100;

type MemberFilter = 'all' | 'friends';

type CsdChatCreateGroupModalProps = {
  token: string;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCsdConversationInput) => Promise<boolean> | boolean;
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

export function CsdChatCreateGroupModal({
  token,
  open,
  busy,
  onClose,
  onSubmit,
}: CsdChatCreateGroupModalProps) {
  const [nameVi, setNameVi] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [friends, setFriends] = useState<CsdChatPersonRow[]>([]);
  const [searchHits, setSearchHits] = useState<CsdChatPersonRow[]>([]);
  const [selected, setSelected] = useState<CsdChatPersonRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setNameVi('');
    setQuery('');
    setFilter('all');
    setSelected([]);
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
    const q = query.trim().toLowerCase();
    const friendMatches = q
      ? friends.filter((p) => p.display_name_vi.toLowerCase().includes(q))
      : friends;
    if (filter === 'friends') return friendMatches;
    return mergePeople(friendMatches, searchHits);
  }, [friends, searchHits, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CsdChatPersonRow[]>();
    for (const person of roster) {
      const key = letterKey(person.display_name_vi);
      const bucket = map.get(key) ?? [];
      bucket.push(person);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [roster]);

  const selectedIds = new Set(selected.map((p) => p.staff_id));
  const canCreate = nameVi.trim().length > 0 && selected.length >= 1 && !busy;

  function togglePerson(person: CsdChatPersonRow) {
    setError('');
    setSelected((prev) => {
      if (prev.some((p) => p.staff_id === person.staff_id)) {
        return prev.filter((p) => p.staff_id !== person.staff_id);
      }
      if (prev.length >= MAX_MEMBERS) {
        setError(`Nhóm tối đa ${MAX_MEMBERS} thành viên`);
        return prev;
      }
      return [...prev, person];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = nameVi.trim();
    if (!name) {
      setError('Nhập tên nhóm');
      return;
    }
    if (selected.length < 1) {
      setError('Chọn ít nhất một thành viên');
      return;
    }
    const ok = await onSubmit({
      kind: 'group',
      name_vi: name,
      member_staff_ids: selected.map((p) => p.staff_id),
    });
    if (ok === false) setError('Tạo nhóm thất bại');
  }

  if (!open) return null;

  return (
    <div className="csd-modal-backdrop csd-chat-create-group-backdrop" role="presentation" onClick={onClose}>
      <form
        className="csd-chat-create-group"
        data-testid="csd-chat-create-group-modal"
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="csd-chat-create-group__head">
          <h3>Tạo nhóm</h3>
          <button type="button" className="csd-chat-icon-btn" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="csd-chat-create-group__identity">
          <span
            className="csd-chat-avatar csd-chat-avatar--thread"
            style={{ background: `hsl(${avatarHue(nameVi || 'nhóm')} 55% 42%)` }}
            aria-hidden
          >
            {initialsFromName(nameVi, 'N')}
          </span>
          <input
            className="kpi-input"
            value={nameVi}
            maxLength={191}
            onChange={(e) => setNameVi(e.target.value)}
            placeholder="Nhập tên nhóm..."
            data-testid="csd-chat-create-group-name"
          />
        </div>

        <label className="csd-chat-search csd-chat-create-group__search">
          <span className="csd-chat-search__icon" aria-hidden>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên người cần thêm"
            data-testid="csd-chat-create-group-search"
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
              data-testid={`csd-chat-create-group-filter-${item.id}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="csd-chat-create-group__body">
          <div className="csd-chat-create-group__picker">
            <h4>{query.trim() ? 'Kết quả' : 'Bạn bè'}</h4>
            {roster.length === 0 ? (
              <p className="muted">
                {friends.length === 0
                  ? 'Chưa có bạn. Vào tab Danh bạ để gửi lời mời.'
                  : 'Không tìm thấy người phù hợp.'}
              </p>
            ) : (
              grouped.map(([letter, people]) => (
                <div key={letter} className="csd-chat-create-group__section">
                  <div className="csd-chat-create-group__letter">{letter}</div>
                  <ul>
                    {people.map((person) => {
                      const checked = selectedIds.has(person.staff_id);
                      return (
                        <li key={person.staff_id}>
                          <button
                            type="button"
                            className={`csd-chat-create-group__person${checked ? ' is-checked' : ''}`}
                            data-testid={`csd-chat-create-group-person-${person.staff_id}`}
                            onClick={() => togglePerson(person)}
                          >
                            <span className={`csd-chat-create-group__check${checked ? ' is-on' : ''}`} aria-hidden>
                              {checked ? '✓' : ''}
                            </span>
                            <span
                              className="csd-chat-avatar csd-chat-avatar--list"
                              style={{ background: `hsl(${avatarHue(person.staff_id)} 55% 42%)` }}
                              aria-hidden
                            >
                              {initialsFromName(person.display_name_vi)}
                            </span>
                            <span>{person.display_name_vi}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <aside className="csd-chat-create-group__chosen" data-testid="csd-chat-create-group-selected">
            <h4>
              Đã chọn {selected.length}/{MAX_MEMBERS}
            </h4>
            {selected.length === 0 ? (
              <p className="muted">Chưa chọn thành viên</p>
            ) : (
              <ul>
                {selected.map((person) => (
                  <li key={person.staff_id}>
                    <span
                      className="csd-chat-avatar csd-chat-avatar--list"
                      style={{ background: `hsl(${avatarHue(person.staff_id)} 55% 42%)` }}
                      aria-hidden
                    >
                      {initialsFromName(person.display_name_vi)}
                    </span>
                    <span className="csd-chat-create-group__chosen-name">{person.display_name_vi}</span>
                    <button
                      type="button"
                      className="csd-chat-create-group__remove"
                      aria-label={`Bỏ ${person.display_name_vi}`}
                      onClick={() => togglePerson(person)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <footer className="csd-chat-create-group__foot">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-sm" disabled={!canCreate} data-testid="csd-chat-create-group-submit">
            Tạo nhóm
          </button>
        </footer>
      </form>
    </div>
  );
}

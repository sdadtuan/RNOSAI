'use client';

import { useEffect, useMemo, useState } from 'react';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import {
  acceptCsdChatFriend,
  deleteCsdChatFriend,
  fetchCsdChatFriendRequests,
  fetchCsdChatFriends,
  fetchCsdChatPeople,
  rejectCsdChatFriend,
  requestCsdChatFriend,
  type CsdChatFriendshipRow,
  type CsdChatPersonRow,
} from '@/lib/crm/csd-api';
import { groupCsdChatPeopleByLetter, resolveCsdPersonAvatar } from '@/lib/crm/csd-chat-display';

export type CsdChatContactsView = 'friends' | 'requests' | 'discover';

type CsdChatContactsProps = {
  token: string;
  view: CsdChatContactsView;
  onViewChange: (view: CsdChatContactsView) => void;
  canWrite: boolean;
  onOpenDm: (staffId: number) => void;
  onIncomingChange?: (count: number) => void;
};

const NAV_ITEMS: { id: CsdChatContactsView; label: string; icon: string }[] = [
  { id: 'friends', label: 'Danh sách bạn bè', icon: 'friends' },
  { id: 'requests', label: 'Lời mời kết bạn', icon: 'requests' },
  { id: 'discover', label: 'Tìm người mới', icon: 'discover' },
];

const VIEW_HEADINGS: Record<CsdChatContactsView, string> = {
  friends: 'Danh sách bạn bè',
  requests: 'Lời mời kết bạn',
  discover: 'Tìm người mới',
};

export function CsdChatContacts({
  token,
  view,
  onViewChange,
  canWrite,
  onOpenDm,
  onIncomingChange,
}: CsdChatContactsProps) {
  const [friendQuery, setFriendQuery] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [people, setPeople] = useState<CsdChatPersonRow[]>([]);
  const [friends, setFriends] = useState<CsdChatPersonRow[]>([]);
  const [incoming, setIncoming] = useState<CsdChatFriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<CsdChatFriendshipRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuStaffId, setMenuStaffId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void Promise.all([fetchCsdChatFriends(token), fetchCsdChatFriendRequests(token)])
        .then(([friendOut, reqOut]) => {
          if (cancelled) return;
          setFriends(friendOut.items ?? []);
          setIncoming(reqOut.incoming ?? []);
          setOutgoing(reqOut.outgoing ?? []);
          onIncomingChange?.((reqOut.incoming ?? []).length);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được danh bạ');
        });
    };
    load();
    const timer = window.setInterval(load, 15_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, onIncomingChange]);

  useEffect(() => {
    if (view !== 'discover') return;
    const term = discoverQuery.trim();
    if (term.length < 2) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchCsdChatPeople(token, term)
        .then((out) => {
          if (!cancelled) setPeople(out.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setPeople([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [view, discoverQuery, token]);

  const filteredFriends = useMemo(() => {
    const term = friendQuery.trim().toLocaleLowerCase('vi-VN');
    const sorted = [...friends].sort((a, b) =>
      a.display_name_vi.localeCompare(b.display_name_vi, 'vi'),
    );
    if (!term) return sorted;
    return sorted.filter((person) => person.display_name_vi.toLocaleLowerCase('vi-VN').includes(term));
  }, [friendQuery, friends]);

  const groupedFriends = useMemo(() => groupCsdChatPeopleByLetter(filteredFriends), [filteredFriends]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      const [reqOut, friendOut] = await Promise.all([
        fetchCsdChatFriendRequests(token),
        fetchCsdChatFriends(token),
      ]);
      setIncoming(reqOut.incoming ?? []);
      setOutgoing(reqOut.outgoing ?? []);
      onIncomingChange?.((reqOut.incoming ?? []).length);
      setFriends(friendOut.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  function renderFriendRow(person: CsdChatPersonRow) {
    const avatar = resolveCsdPersonAvatar(person);
    return (
      <li key={person.staff_id} className="csd-chat-contacts-friend">
        <button
          type="button"
          className="csd-chat-contacts-friend__main"
          onClick={() => onOpenDm(person.staff_id)}
        >
          <CsdChatAvatar
            token={token}
            name={person.display_name_vi}
            seed={avatar.seed}
            staffId={avatar.staffId}
            hasAvatar={avatar.hasAvatar}
            avatarUpdatedAt={avatar.avatarUpdatedAt}
            className="csd-chat-avatar csd-chat-avatar--contacts"
          />
          <span className="csd-chat-contacts-friend__name">{person.display_name_vi}</span>
        </button>
        <div className="csd-chat-contacts-friend__menu-wrap">
          <button
            type="button"
            className="csd-chat-contacts-friend__menu"
            aria-label={`Tác vụ ${person.display_name_vi}`}
            aria-expanded={menuStaffId === person.staff_id}
            onClick={() => setMenuStaffId((id) => (id === person.staff_id ? null : person.staff_id))}
          >
            ⋯
          </button>
          {menuStaffId === person.staff_id ? (
            <div className="csd-chat-contacts-friend__menu-list" role="menu">
              <button type="button" role="menuitem" onClick={() => onOpenDm(person.staff_id)}>
                Nhắn tin
              </button>
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="csd-chat-contacts-shell" data-testid="csd-chat-contacts-shell">
      <nav className="csd-chat-contacts-nav" aria-label="Danh mục danh bạ">
        <div className="csd-chat-contacts-nav__head">
          <label className="csd-chat-search csd-chat-contacts-nav__search">
            <span className="csd-chat-search__icon" aria-hidden>
              ⌕
            </span>
            <input placeholder="Tìm kiếm" aria-label="Tìm kiếm danh bạ" />
          </label>
        </div>
        <ul className="csd-chat-contacts-nav__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`csd-chat-contacts-nav__item${view === item.id ? ' is-active' : ''}`}
                data-testid={`csd-chat-contacts-nav-${item.id}`}
                onClick={() => onViewChange(item.id)}
              >
                <span className={`csd-chat-contacts-nav__ico csd-chat-contacts-nav__ico--${item.icon}`} aria-hidden />
                <span>{item.label}</span>
                {item.id === 'requests' && incoming.length > 0 ? (
                  <span className="csd-chat-contacts-nav__badge">{incoming.length}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="csd-chat-contacts-main">
        <header className="csd-chat-contacts-main__head">
          <span className={`csd-chat-contacts-main__ico csd-chat-contacts-main__ico--${view}`} aria-hidden />
          <h3>{VIEW_HEADINGS[view]}</h3>
        </header>

        {error ? <p className="error csd-chat-contacts-main__error">{error}</p> : null}

        {view === 'friends' ? (
          <>
            <p className="csd-chat-contacts-main__count">Bạn bè ({friends.length})</p>
            <div className="csd-chat-contacts-toolbar">
              <label className="csd-chat-contacts-toolbar__search">
                <span aria-hidden>⌕</span>
                <input
                  placeholder="Tìm bạn"
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  data-testid="csd-chat-contacts-friend-q"
                />
              </label>
              <span className="csd-chat-contacts-toolbar__select">Tên (A-Z)</span>
              <span className="csd-chat-contacts-toolbar__select">Tất cả</span>
            </div>
            <div className="csd-chat-contacts-scroll" data-testid="csd-chat-contacts-friends">
              {groupedFriends.length === 0 ? (
                <p className="muted csd-chat-contacts-empty">Chưa có bạn — dùng Tìm người mới để kết bạn.</p>
              ) : (
                groupedFriends.map(([letter, rows]) => (
                  <section key={letter} className="csd-chat-contacts-section">
                    <h4 className="csd-chat-contacts-section__letter">{letter}</h4>
                    <ul className="csd-chat-contacts-section__list">{rows.map(renderFriendRow)}</ul>
                  </section>
                ))
              )}
            </div>
          </>
        ) : null}

        {view === 'discover' ? (
          <>
            <div className="csd-chat-contacts-toolbar">
              <label className="csd-chat-contacts-toolbar__search csd-chat-contacts-toolbar__search--wide">
                <span aria-hidden>⌕</span>
                <input
                  placeholder="Tìm người (≥ 2 ký tự)"
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                  data-testid="csd-chat-people-q"
                />
              </label>
            </div>
            <div className="csd-chat-contacts-scroll">
              {people.length > 0 ? (
                <ul className="csd-chat-contacts-section__list">
                  {people.map((person) => {
                    const avatar = resolveCsdPersonAvatar(person);
                    return (
                      <li key={person.staff_id} className="csd-chat-contacts-friend">
                        <div className="csd-chat-contacts-friend__main csd-chat-contacts-friend__main--static">
                          <CsdChatAvatar
                            token={token}
                            name={person.display_name_vi}
                            seed={avatar.seed}
                            staffId={avatar.staffId}
                            hasAvatar={avatar.hasAvatar}
                            avatarUpdatedAt={avatar.avatarUpdatedAt}
                            className="csd-chat-avatar csd-chat-avatar--contacts"
                          />
                          <span className="csd-chat-contacts-friend__name">{person.display_name_vi}</span>
                        </div>
                        {canWrite ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            data-testid="csd-chat-friend-request"
                            onClick={() => void run(() => requestCsdChatFriend(token, person.staff_id))}
                          >
                            Kết bạn
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : discoverQuery.trim().length >= 2 ? (
                <p className="muted csd-chat-contacts-empty">Không tìm thấy</p>
              ) : (
                <p className="muted csd-chat-contacts-empty">Nhập tên hoặc email để tìm người trong công ty.</p>
              )}
            </div>
          </>
        ) : null}

        {view === 'requests' ? (
          <div className="csd-chat-contacts-scroll" data-testid="csd-chat-contacts-requests">
            <h4 className="csd-chat-contacts-subtitle">Lời mời đến</h4>
            <ul className="csd-chat-contacts-section__list">
              {incoming.length === 0 ? (
                <li className="muted csd-chat-contacts-empty">Không có lời mời đến</li>
              ) : (
                incoming.map((row) => (
                  <li key={row.id} className="csd-chat-contacts-friend" data-testid="csd-chat-friend-incoming">
                    <div className="csd-chat-contacts-friend__main csd-chat-contacts-friend__main--static">
                      <CsdChatAvatar
                        token={token}
                        name={`Staff #${row.requester_staff_id}`}
                        seed={row.requester_staff_id}
                        staffId={row.requester_staff_id}
                        className="csd-chat-avatar csd-chat-avatar--contacts"
                      />
                      <span className="csd-chat-contacts-friend__name">Staff #{row.requester_staff_id}</span>
                    </div>
                    {canWrite ? (
                      <span className="csd-chat-contacts__actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() => void run(() => acceptCsdChatFriend(token, row.id))}
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={busy}
                          onClick={() => void run(() => rejectCsdChatFriend(token, row.id))}
                        >
                          Từ chối
                        </button>
                      </span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            <h4 className="csd-chat-contacts-subtitle">Đã gửi</h4>
            <ul className="csd-chat-contacts-section__list">
              {outgoing.length === 0 ? (
                <li className="muted csd-chat-contacts-empty">Chưa gửi lời mời</li>
              ) : (
                outgoing.map((row) => (
                  <li key={row.id} className="csd-chat-contacts-friend">
                    <div className="csd-chat-contacts-friend__main csd-chat-contacts-friend__main--static">
                      <CsdChatAvatar
                        token={token}
                        name={`Staff #${row.addressee_staff_id}`}
                        seed={row.addressee_staff_id}
                        staffId={row.addressee_staff_id}
                        className="csd-chat-avatar csd-chat-avatar--contacts"
                      />
                      <span className="csd-chat-contacts-friend__name">Staff #{row.addressee_staff_id}</span>
                    </div>
                    {canWrite ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={busy}
                        onClick={() => void run(() => deleteCsdChatFriend(token, row.id))}
                      >
                        Hủy
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

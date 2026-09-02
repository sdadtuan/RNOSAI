'use client';

import { useEffect, useState } from 'react';
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

type CsdChatContactsProps = {
  token: string;
  mode: 'directory' | 'requests';
  canWrite: boolean;
  onOpenDm: (staffId: number) => void;
  onIncomingChange?: (count: number) => void;
};

export function CsdChatContacts({
  token,
  mode,
  canWrite,
  onOpenDm,
  onIncomingChange,
}: CsdChatContactsProps) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<CsdChatPersonRow[]>([]);
  const [friends, setFriends] = useState<CsdChatPersonRow[]>([]);
  const [incoming, setIncoming] = useState<CsdChatFriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<CsdChatFriendshipRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void Promise.all([
        fetchCsdChatFriends(token),
        fetchCsdChatFriendRequests(token),
      ])
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
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, onIncomingChange]);

  useEffect(() => {
    if (mode !== 'directory') return;
    const term = q.trim();
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
  }, [mode, q, token]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      const reqOut = await fetchCsdChatFriendRequests(token);
      setIncoming(reqOut.incoming ?? []);
      setOutgoing(reqOut.outgoing ?? []);
      onIncomingChange?.((reqOut.incoming ?? []).length);
      const friendOut = await fetchCsdChatFriends(token);
      setFriends(friendOut.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'requests') {
    return (
      <section className="csd-chat-contacts page-card">
        <h3 className="kpi-section-title">Lời mời</h3>
        {error ? <p className="error">{error}</p> : null}
        <h4 className="kpi-section-title">Đến</h4>
        <ul className="csd-chat-contacts__list">
          {incoming.length === 0 ? (
            <li className="muted">Không có lời mời đến</li>
          ) : (
            incoming.map((row) => (
              <li key={row.id} data-testid="csd-chat-friend-incoming">
                <span>Staff #{row.requester_staff_id}</span>
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
        <h4 className="kpi-section-title">Đã gửi</h4>
        <ul className="csd-chat-contacts__list">
          {outgoing.length === 0 ? (
            <li className="muted">Chưa gửi lời mời</li>
          ) : (
            outgoing.map((row) => (
              <li key={row.id}>
                <span>Staff #{row.addressee_staff_id}</span>
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
      </section>
    );
  }

  return (
    <section className="csd-chat-contacts page-card">
      <h3 className="kpi-section-title">Danh bạ</h3>
      {error ? <p className="error">{error}</p> : null}
      <input
        className="kpi-input"
        placeholder="Tìm người (≥ 2 ký tự)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-testid="csd-chat-people-q"
      />
      {people.length > 0 ? (
        <ul className="csd-chat-contacts__list">
          {people.map((person) => (
            <li key={person.staff_id}>
              <span>{person.display_name_vi}</span>
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
          ))}
        </ul>
      ) : q.trim().length >= 2 ? (
        <p className="muted">Không tìm thấy</p>
      ) : null}

      <h4 className="kpi-section-title">Bạn bè</h4>
      <ul className="csd-chat-contacts__list">
        {friends.length === 0 ? (
          <li className="muted">Chưa có bạn — gửi lời mời phía trên</li>
        ) : (
          friends.map((person) => (
            <li key={person.staff_id}>
              <button type="button" className="csd-chat-contacts__dm" onClick={() => onOpenDm(person.staff_id)}>
                {person.display_name_vi}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

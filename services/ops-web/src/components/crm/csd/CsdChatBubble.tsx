'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  downloadCsdFile,
  previewCsdFileObjectUrl,
  type CsdAttachmentRow,
  type CsdChatEmotionId,
  type CsdMessageRow,
} from '@/lib/crm/csd-api';
import { CSD_CHAT_EMOTIONS, isCsdChatEmotionMessage, summarizeChatReactions } from '@/lib/crm/csd-chat-emotions';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import {
  clampElementInChatFrame,
  findChatFrame,
  formatChatListTime,
  isCsdChatImageMime,
  type CsdMessagePeerDisplay,
} from '@/lib/crm/csd-chat-display';

const EDIT_WINDOW_MS = 15 * 60_000;
const PLACEHOLDER_IMG =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function canEditOwn(message: CsdMessageRow, meStaffId: number | null): boolean {
  if (!meStaffId || message.is_deleted || message.author_staff_id !== meStaffId) return false;
  const created = new Date(message.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created <= EDIT_WINDOW_MS;
}

function canDeleteOwn(message: CsdMessageRow, meStaffId: number | null): boolean {
  return Boolean(meStaffId && !message.is_deleted && message.author_staff_id === meStaffId);
}

function renderMessageBody(text: string) {
  const parts = String(text).split(/(@\d+|#PTT-\d{4}-\d{6})/gi);
  return parts.map((part, index) =>
    /^@\d+$/.test(part) || /^#PTT-\d{4}-\d{6}$/i.test(part) ? (
      <strong key={`${part}-${index}`}>{part}</strong>
    ) : (
      part
    ),
  );
}

function CsdChatImageThumb({
  token,
  file,
}: {
  token: string;
  file: CsdAttachmentRow;
}) {
  const [src, setSrc] = useState(PLACEHOLDER_IMG);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void previewCsdFileObjectUrl(token, file.id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        /* keep placeholder */
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [token, file.id]);

  return (
    <button
      type="button"
      className="csd-chat-thumb-btn"
      onClick={() => void downloadCsdFile(token, file.id, file.file_name)}
    >
      <img className="csd-chat-thumb" src={src} alt={file.file_name} data-testid="csd-chat-image" />
    </button>
  );
}

export type CsdChatBubbleProps = {
  token: string;
  message: CsdMessageRow;
  isMine: boolean;
  quoted: CsdMessageRow | null;
  ticketPill: string | null;
  ticketHref: string | null;
  closed: boolean;
  canWrite: boolean;
  busy: boolean;
  density: 'page' | 'dock';
  showName: boolean;
  peer: CsdMessagePeerDisplay | null;
  allowCreateTicket: boolean;
  meStaffId: number | null;
  onReply: (m: CsdMessageRow) => void;
  onCreateTicket: (m: CsdMessageRow) => void;
  onEdit: (m: CsdMessageRow, body: string) => void;
  onDelete: (m: CsdMessageRow) => void;
  onCopyLink: (m: CsdMessageRow) => void;
  onForward: (m: CsdMessageRow) => void;
  onReact?: (m: CsdMessageRow, emotion: CsdChatEmotionId) => void;
};

export function CsdChatBubble({
  token,
  message,
  isMine,
  quoted,
  ticketPill,
  ticketHref,
  closed,
  canWrite,
  busy,
  density,
  showName,
  peer,
  allowCreateTicket,
  meStaffId,
  onReply,
  onCreateTicket,
  onEdit,
  onDelete,
  onCopyLink,
  onForward,
  onReact,
}: CsdChatBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.body_text);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [reactHover, setReactHover] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reactWrapRef = useRef<HTMLDivElement | null>(null);
  const reactPanelRef = useRef<HTMLDivElement | null>(null);
  const menuListRef = useRef<HTMLDivElement | null>(null);
  const reactLeaveTimer = useRef<number | null>(null);
  const showMenu = canWrite && !closed && !message.is_deleted && !editing;
  const reactionSummary = summarizeChatReactions(message.reactions);
  const pickerOpen = reactOpen || reactHover;
  const canPickReact = Boolean(onReact && canWrite && !closed && !message.is_deleted && !editing);

  function clearReactLeave() {
    if (reactLeaveTimer.current != null) {
      window.clearTimeout(reactLeaveTimer.current);
      reactLeaveTimer.current = null;
    }
  }

  function openReactHover() {
    clearReactLeave();
    setReactHover(true);
  }

  function scheduleReactLeave() {
    clearReactLeave();
    reactLeaveTimer.current = window.setTimeout(() => setReactHover(false), 240);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => () => clearReactLeave(), []);

  useEffect(() => {
    if (!reactOpen) return;
    function onDoc(e: MouseEvent) {
      if (reactWrapRef.current && !reactWrapRef.current.contains(e.target as Node)) {
        setReactOpen(false);
        setReactHover(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [reactOpen]);

  useLayoutEffect(() => {
    if (!reactOpen && !reactHover) return;
    const panel = reactPanelRef.current;
    const pin = () => clampElementInChatFrame(panel);
    const frame = findChatFrame(panel);
    const id = requestAnimationFrame(pin);
    window.addEventListener('resize', pin);
    frame?.addEventListener('scroll', pin, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', pin);
      frame?.removeEventListener('scroll', pin);
    };
  }, [reactOpen, reactHover]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const list = menuListRef.current;
    const pin = () => clampElementInChatFrame(list);
    const frame = findChatFrame(list);
    const id = requestAnimationFrame(pin);
    window.addEventListener('resize', pin);
    frame?.addEventListener('scroll', pin, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', pin);
      frame?.removeEventListener('scroll', pin);
    };
  }, [menuOpen]);

  return (
    <article
      className={`csd-chat-message${isMine ? ' is-mine' : ' is-theirs'}${message.is_deleted ? ' is-deleted' : ''}${density === 'dock' ? ' is-dock' : ' is-page'}${menuOpen ? ' is-menu-open' : ''}`}
    >
      {!isMine && peer ? (
        <CsdChatAvatar
          token={token}
          name={peer.name}
          seed={peer.seed}
          staffId={peer.staffId}
          hasAvatar={peer.hasAvatar}
          avatarUpdatedAt={peer.avatarUpdatedAt}
        />
      ) : null}
      <div className="csd-chat-message__col">
        {showName && peer ? (
          <div className="csd-chat-message__meta muted">{peer.name}</div>
        ) : null}
        <div className="csd-chat-bubble-row">
          <div className={`csd-chat-bubble-stack${reactionSummary.total > 0 ? ' has-reactions' : ''}`}>
          <div className="csd-chat-bubble">
            {quoted ? (
              <p className="csd-chat-quote muted">
                ↩ {quoted.is_deleted ? 'Đã xóa' : quoted.body_text.slice(0, 120)}
              </p>
            ) : null}
            {message.is_deleted ? (
              <p className="csd-chat-deleted" data-testid="csd-chat-deleted">
                Đã xóa
              </p>
            ) : editing ? (
              <div className="csd-chat-edit">
                <textarea
                  className="kpi-input"
                  rows={2}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  data-testid="csd-chat-edit-draft"
                />
                <div className="csd-chat-message__actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setEditing(false);
                      setEditDraft(message.body_text);
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || !editDraft.trim()}
                    onClick={() => {
                      onEdit(message, editDraft.trim());
                      setEditing(false);
                    }}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <p className={isCsdChatEmotionMessage(message.body_text) ? 'csd-chat-emotion-msg' : undefined}>
                {renderMessageBody(message.body_text)}
              </p>
            )}
            {!message.is_deleted && (message.attachments ?? []).length > 0 ? (
              <ul className="csd-chat-files">
                {(message.attachments ?? []).map((file) => (
                  <li key={file.id}>
                    {isCsdChatImageMime(file.mime_type) ? (
                      <CsdChatImageThumb token={token} file={file} />
                    ) : (
                      <button
                        type="button"
                        className="csd-chat-file-chip"
                        onClick={() => void downloadCsdFile(token, file.id, file.file_name)}
                      >
                        {file.file_name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {message.ticket_id && ticketHref ? (
              <Link href={ticketHref} className="csd-chat-ticket-pill" data-testid="csd-chat-ticket-pill">
                {ticketPill ?? 'Ticket liên kết'}
              </Link>
            ) : null}
            {!editing ? (
              <footer className="csd-chat-bubble__time" data-testid="csd-chat-bubble-time">
                {formatChatListTime(message.created_at)}
                {message.edited_at && !message.is_deleted ? ' · đã sửa' : ''}
              </footer>
            ) : null}
          </div>
          {reactionSummary.total > 0 || canPickReact ? (
            <div
              ref={reactWrapRef}
              className={`csd-chat-react-bar${pickerOpen ? ' is-open' : ''}${reactionSummary.total > 0 ? ' has-reactions' : ''}`}
            >
              {reactionSummary.total > 0 ? (
                <button
                  type="button"
                  className={`csd-chat-react-pill${reactionSummary.mine ? ' is-mine' : ''}`}
                  data-testid="csd-chat-react-chips"
                  disabled={!canPickReact || busy}
                  onClick={() => {
                    if (!canPickReact) return;
                    setReactOpen(true);
                    setReactHover(true);
                  }}
                >
                  <span className="csd-chat-react-pill__icons">
                    {reactionSummary.emojis.map((emoji) => (
                      <span key={emoji}>{emoji}</span>
                    ))}
                  </span>
                  <span className="csd-chat-react-pill__count">{reactionSummary.total}</span>
                </button>
              ) : null}
              {canPickReact ? (
                <div
                  className={`csd-chat-react${pickerOpen ? ' is-open' : ''}`}
                  onMouseEnter={openReactHover}
                  onMouseLeave={scheduleReactLeave}
                >
                  <button
                    type="button"
                    className="csd-chat-react-trigger"
                    data-testid="csd-chat-react-trigger"
                    aria-label="Thả emotion"
                    aria-expanded={pickerOpen}
                    onClick={() => setReactOpen((v) => !v)}
                  >
                    <span aria-hidden>👍</span>
                  </button>
                  <div
                    ref={reactPanelRef}
                    className="csd-chat-react-panel"
                    data-testid="csd-chat-react-panel"
                    role="menu"
                  >
                    {CSD_CHAT_EMOTIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        title={item.label}
                        data-testid={`csd-chat-react-${item.id}`}
                        className={reactionSummary.mineEmotion === item.id ? 'is-selected' : undefined}
                        onClick={() => {
                          setReactOpen(false);
                          setReactHover(false);
                          onReact?.(message, item.id);
                        }}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
          {showMenu ? (
            <div className="csd-chat-msg-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="csd-chat-msg-menu"
                data-testid="csd-chat-msg-menu"
                aria-label="Tác vụ tin nhắn"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                ⋯
              </button>
              {menuOpen ? (
                <div ref={menuListRef} className="csd-chat-msg-menu__list" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReply(message); }}>
                    Trả lời
                  </button>
                  {allowCreateTicket ? (
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCreateTicket(message); }}>
                      Tạo ticket
                    </button>
                  ) : null}
                  {canEditOwn(message, meStaffId) ? (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="csd-chat-edit"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditing(true);
                        setEditDraft(message.body_text);
                      }}
                    >
                      Sửa
                    </button>
                  ) : null}
                  {canDeleteOwn(message, meStaffId) ? (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="csd-chat-delete"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(message);
                      }}
                    >
                      Xóa
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCopyLink(message); }}>
                    Copy link
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onForward(message); }}>
                    Chuyển tiếp
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

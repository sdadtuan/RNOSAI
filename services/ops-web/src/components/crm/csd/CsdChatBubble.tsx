'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  downloadCsdFile,
  formatCsdWhen,
  previewCsdFileObjectUrl,
  type CsdAttachmentRow,
  type CsdChatEmotionId,
  type CsdMessageRow,
} from '@/lib/crm/csd-api';
import { CSD_CHAT_EMOTIONS, isCsdChatEmotionMessage } from '@/lib/crm/csd-chat-emotions';
import { avatarHue, initialsFromName, isCsdChatImageMime } from '@/lib/crm/csd-chat-display';

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const name = message.author_staff_name ?? 'Khách';
  const seed = message.author_staff_id ?? 'KH';
  const initials = initialsFromName(name);
  const hue = avatarHue(seed);
  const showMenu = canWrite && !closed && !message.is_deleted && !editing;

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

  return (
    <article
      className={`csd-chat-message${isMine ? ' is-mine' : ' is-theirs'}${message.is_deleted ? ' is-deleted' : ''}${density === 'dock' ? ' is-dock' : ' is-page'}${menuOpen ? ' is-menu-open' : ''}`}
    >
      {!isMine ? (
        <span className="csd-chat-avatar" style={{ background: `hsl(${hue} 55% 42%)` }} aria-hidden>
          {initials}
        </span>
      ) : null}
      <div className="csd-chat-message__col">
        {showName || !isMine ? (
          <div className="csd-chat-message__meta muted">
            {name} · {formatCsdWhen(message.created_at)}
            {message.edited_at && !message.is_deleted ? ' · đã sửa' : ''}
          </div>
        ) : (
          <div className="csd-chat-message__meta muted">
            {formatCsdWhen(message.created_at)}
            {message.edited_at && !message.is_deleted ? ' · đã sửa' : ''}
          </div>
        )}
        <div className="csd-chat-bubble-row">
          <div className="csd-chat-bubble-stack">
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
            {(message.reactions ?? []).length > 0 ? (
              <ul className="csd-chat-react-chips" data-testid="csd-chat-react-chips">
                {(message.reactions ?? []).map((row) => {
                  const meta = CSD_CHAT_EMOTIONS.find((item) => item.id === row.emotion);
                  return (
                    <li key={row.emotion}>
                      <button
                        type="button"
                        className={`csd-chat-react-chip${row.mine ? ' is-mine' : ''}`}
                        disabled={!onReact || !canWrite || closed || busy}
                        onClick={() => onReact?.(message, row.emotion)}
                      >
                        {meta?.emoji ?? row.emotion} {row.count}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          {onReact && canWrite && !closed && !message.is_deleted && !editing ? (
            <div className={`csd-chat-react${reactOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="csd-chat-react-trigger"
                data-testid="csd-chat-react-trigger"
                aria-label="Thả emotion"
                aria-expanded={reactOpen}
                onClick={() => setReactOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 11.5v7h-2a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 5.5 11.5h2Zm0 0 3-6a1.8 1.8 0 0 1 3.4 1.1L13.2 9.5H19a2 2 0 0 1 1.95 2.45l-1.1 6A2 2 0 0 1 17.9 19.5H7.5"
                  />
                </svg>
              </button>
              <div className="csd-chat-react-panel" data-testid="csd-chat-react-panel" role="menu">
                {CSD_CHAT_EMOTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    title={item.label}
                    data-testid={`csd-chat-react-${item.id}`}
                    onClick={() => {
                      setReactOpen(false);
                      onReact(message, item.id);
                    }}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
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
                <div className="csd-chat-msg-menu__list" role="menu">
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

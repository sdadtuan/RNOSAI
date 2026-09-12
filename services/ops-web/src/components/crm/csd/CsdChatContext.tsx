'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CsdChatContextMedia } from '@/components/crm/csd/CsdChatContextMedia';
import {
  fetchCsdConversationAttachments,
  type CsdConversationAttachmentItem,
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';
import { splitCsdConversationAttachments } from '@/lib/crm/csd-chat-display';

export const CSD_CHAT_KIND_LABELS: Record<string, string> = {
  client: 'Khách hàng',
  direct: 'DM',
  group: 'Nội bộ nhóm',
  project: 'Dự án',
  announcement: 'Thông báo',
};

type CsdChatContextProps = {
  token: string;
  mediaRefreshKey?: string;
  active: CsdConversationRow | null;
  members: CsdConversationMemberRow[];
  relatedTickets: CsdTicketRow[];
  memberStaffId: string;
  aiPeriod: '24h' | '7d' | 'all';
  aiSummary: AiSummary | null;
  canWrite: boolean;
  busy: boolean;
  closed: boolean;
  archived: boolean;
  onMemberStaffId: (value: string) => void;
  onAddMember: () => void;
  onRemoveMember: (staffId: number) => void;
  onClose: () => void;
  onArchive: () => void;
  onCreateAiActionTicket: (index: number, title: string) => void;
  onAiPeriod: (period: '24h' | '7d' | 'all') => void;
  onSummarize: () => void;
  showMobileBack?: boolean;
  onMobileBack?: () => void;
  onClosePanel?: () => void;
  onRename?: (aliasVi: string) => Promise<boolean>;
  variant?: 'column' | 'sheet';
};

type AiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
  ai_interaction_id?: string;
};

function ContextSection({
  title,
  open,
  onToggle,
  testId,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="csd-chat-context-section">
      <button
        type="button"
        className="csd-chat-context-section__head"
        aria-expanded={open}
        data-testid={testId}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className="csd-chat-context-section__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className="csd-chat-context-section__body">{children}</div> : null}
    </section>
  );
}

export function CsdChatContext({
  token,
  mediaRefreshKey = '',
  active,
  members,
  relatedTickets,
  memberStaffId,
  aiPeriod,
  aiSummary,
  canWrite,
  busy,
  closed,
  archived,
  onMemberStaffId,
  onAddMember,
  onRemoveMember,
  onClose,
  onArchive,
  onCreateAiActionTicket,
  onAiPeriod,
  onSummarize,
  showMobileBack,
  onMobileBack,
  onClosePanel,
  onRename,
  variant = 'column',
}: CsdChatContextProps) {
  const isSheet = variant === 'sheet';
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(active?.alias_vi || active?.name_vi || '');
  const [attachments, setAttachments] = useState<CsdConversationAttachmentItem[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState('');

  const media = useMemo(() => splitCsdConversationAttachments(attachments), [attachments]);

  useEffect(() => {
    setAliasDraft(active?.alias_vi || active?.name_vi || '');
    setDetailsOpen(false);
    setTicketsOpen(true);
    setMembersOpen(true);
    setAiOpen(false);
  }, [active?.id, active?.alias_vi, active?.name_vi]);

  useEffect(() => {
    if (!active?.id) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    setAttachmentsLoading(true);
    setAttachmentsError('');
    void fetchCsdConversationAttachments(token, active.id)
      .then((out) => {
        if (!cancelled) setAttachments(out.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setAttachments([]);
          setAttachmentsError(err instanceof Error ? err.message : 'Không tải được ảnh/file');
        }
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active?.id, token, mediaRefreshKey]);

  return (
    <aside className={`csd-chat-workspace__context csd-chat-context-panel${isSheet ? ' is-sheet' : ''}`}>
      {showMobileBack && !isSheet ? (
        <button type="button" className="csd-chat-context-back" onClick={onMobileBack}>
          ← Hội thoại
        </button>
      ) : null}
      {active ? (
        <>
          {onClosePanel ? (
            <header className="csd-chat-context-head">
              <h3 className="csd-chat-context-head__title">Thông tin hội thoại</h3>
              <button
                type="button"
                className="csd-chat-context-head__close"
                aria-label="Ẩn thông tin"
                data-testid="csd-chat-context-panel-close"
                onClick={onClosePanel}
              >
                ×
              </button>
            </header>
          ) : isSheet ? (
            <header className="csd-chat-context-head">
              <h3 className="csd-chat-context-head__title">Thông tin</h3>
            </header>
          ) : null}

          <div className="csd-chat-context-scroll stack-gap">
            <ContextSection
              title="Chi tiết hội thoại"
              open={detailsOpen}
              onToggle={() => setDetailsOpen((v) => !v)}
              testId="csd-chat-context-toggle"
            >
              <div className="csd-chat-context-meta stack-gap" data-testid="csd-chat-context-meta">
                <p className="csd-chat-context-line">
                  <span>Loại</span>
                  <strong>{CSD_CHAT_KIND_LABELS[active.kind] ?? active.kind}</strong>
                </p>
                <p className="csd-chat-context-line">
                  <span>Tên hiển thị</span>
                  <strong>{active.name_vi}</strong>
                </p>
                {onRename && canWrite ? (
                  <form
                    className="csd-chat-rename csd-chat-rename--stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void onRename(aliasDraft.trim());
                    }}
                  >
                    <label className="csd-chat-context-label" htmlFor="csd-chat-context-rename">
                      Tên gợi nhớ (chỉ mình bạn thấy)
                    </label>
                    <input
                      id="csd-chat-context-rename"
                      className="csd-chat-context-input"
                      value={aliasDraft}
                      maxLength={191}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      placeholder={active.name_vi}
                      data-testid="csd-chat-context-rename-input"
                    />
                    <button
                      type="submit"
                      className="csd-chat-context-btn"
                      disabled={busy}
                      data-testid="csd-chat-context-rename-save"
                    >
                      Lưu tên
                    </button>
                  </form>
                ) : null}
                <p className="csd-chat-context-line">
                  <span>Tài khoản</span>
                  <strong>{active.client_account_id ?? '—'}</strong>
                </p>
                {active.kind === 'project' ? (
                  <p className="csd-chat-context-line">
                    <span>Dự án</span>
                    <strong>
                      {active.project_ref_kind ?? '—'} / {active.project_ref_id ?? '—'}
                    </strong>
                  </p>
                ) : null}
                <p className="csd-chat-context-line">
                  <span>Trạng thái</span>
                  <strong>{archived ? 'Lưu trữ' : closed ? 'Đã đóng' : active.status ?? 'active'}</strong>
                </p>
                {!isSheet && canWrite && !closed && !archived ? (
                  <button type="button" className="csd-chat-context-btn csd-chat-context-btn--ghost" disabled={busy} onClick={onClose}>
                    Đóng hội thoại
                  </button>
                ) : null}
                {!isSheet && canWrite && !archived ? (
                  <button
                    type="button"
                    className="csd-chat-context-btn csd-chat-context-btn--ghost"
                    disabled={busy}
                    onClick={onArchive}
                    data-testid="csd-chat-archive"
                  >
                    Lưu trữ
                  </button>
                ) : null}
              </div>
            </ContextSection>

            <CsdChatContextMedia
              token={token}
              loading={attachmentsLoading}
              error={attachmentsError}
              images={media.images}
              files={media.files}
            />

            <ContextSection title="Ticket liên quan" open={ticketsOpen} onToggle={() => setTicketsOpen((v) => !v)}>
              <ul className="csd-chat-related" data-testid="csd-chat-related-tickets">
                {relatedTickets.length === 0 ? (
                  <li className="csd-chat-context-empty">Chưa có ticket</li>
                ) : (
                  relatedTickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/crm/csd/tickets/${t.id}`} className="csd-chat-ticket-pill">
                        {t.code} · {t.priority} · {t.status}
                      </Link>
                      <span className="csd-chat-context-sub">{t.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </ContextSection>

            <ContextSection title="Thành viên" open={membersOpen} onToggle={() => setMembersOpen((v) => !v)}>
              <ul className="csd-chat-members" data-testid="csd-chat-members">
                {members.length === 0 ? (
                  <li className="csd-chat-context-empty">Chưa có thành viên</li>
                ) : (
                  members.map((m) => (
                    <li key={`${m.conversation_id}-${m.member_staff_id}`}>
                      <span className="csd-chat-members__name">
                        {m.display_name_vi || 'Thành viên'} · {m.role === 'owner' ? 'Chủ' : m.role}
                      </span>
                      {canWrite && m.role !== 'owner' ? (
                        <button
                          type="button"
                          className="csd-chat-context-link-btn"
                          disabled={busy}
                          onClick={() => onRemoveMember(m.member_staff_id)}
                        >
                          Xóa
                        </button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {!isSheet && canWrite && !closed && !archived ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAddMember();
                  }}
                  className="csd-chat-member-form"
                >
                  <input
                    className="csd-chat-context-input"
                    inputMode="numeric"
                    placeholder="Staff id"
                    value={memberStaffId}
                    onChange={(e) => onMemberStaffId(e.target.value)}
                    data-testid="csd-chat-member-id"
                  />
                  <button
                    type="submit"
                    className="csd-chat-context-btn csd-chat-context-btn--soft"
                    disabled={busy || !memberStaffId.trim()}
                  >
                    Thêm
                  </button>
                </form>
              ) : null}
            </ContextSection>

            {isSheet ? null : (
              <ContextSection title="Tóm tắt AI" open={aiOpen} onToggle={() => setAiOpen((v) => !v)}>
                <div className="csd-chat-ai-period">
                  {(['24h', '7d', 'all'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`csd-chat-context-chip${aiPeriod === p ? ' is-active' : ''}`}
                      onClick={() => onAiPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="csd-chat-context-btn csd-chat-context-btn--wide"
                  disabled={busy}
                  onClick={onSummarize}
                  data-testid="csd-chat-ai-summary"
                >
                  Tóm tắt AI
                </button>
                {aiSummary ? (
                  <div className="csd-chat-ai-output" data-testid="csd-chat-ai-output">
                    <p>
                      <strong>Tóm tắt</strong>
                      <br />
                      {aiSummary.summary}
                    </p>
                    <p>
                      <strong>Quyết định</strong>
                      <br />
                      {aiSummary.decisions.join(' · ') || '—'}
                    </p>
                    <p>
                      <strong>Action</strong>
                    </p>
                    {aiSummary.actions.length === 0 ? (
                      <p className="csd-chat-context-empty">—</p>
                    ) : (
                      <ul className="csd-chat-ai-actions" data-testid="csd-chat-ai-actions">
                        {aiSummary.actions.map((action, index) => (
                          <li key={`${index}-${action.slice(0, 24)}`}>
                            <label>
                              <input type="checkbox" readOnly checked /> {action}
                            </label>
                            {canWrite ? (
                              <button
                                type="button"
                                className="csd-chat-context-link-btn"
                                disabled={busy || !aiSummary.ai_interaction_id}
                                onClick={() => onCreateAiActionTicket(index, action.slice(0, 255))}
                              >
                                Tạo ticket
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>
                      <strong>Rủi ro</strong>
                      <br />
                      {aiSummary.risks.join(' · ') || '—'}
                    </p>
                  </div>
                ) : null}
              </ContextSection>
            )}
          </div>
        </>
      ) : (
        <p className="csd-chat-context-empty">Chọn hội thoại để xem thông tin</p>
      )}
    </aside>
  );
}

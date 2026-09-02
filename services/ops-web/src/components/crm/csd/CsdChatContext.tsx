'use client';

import Link from 'next/link';
import {
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';

export const CSD_CHAT_KIND_LABELS: Record<string, string> = {
  client: 'Khách hàng',
  direct: 'DM',
  group: 'Nội bộ nhóm',
  project: 'Dự án',
  announcement: 'Thông báo',
};

type CsdChatContextProps = {
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
  variant?: 'column' | 'sheet';
};

type AiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
  ai_interaction_id?: string;
};

export function CsdChatContext({
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
  variant = 'column',
}: CsdChatContextProps) {
  const isSheet = variant === 'sheet';
  return (
    <aside className={`csd-chat-workspace__context page-card stack-gap${isSheet ? ' is-sheet' : ''}`}>
      {showMobileBack && !isSheet ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={onMobileBack}>
          ← Thread
        </button>
      ) : null}
      <h3 className="kpi-section-title">{isSheet ? 'Thông tin' : 'Ngữ cảnh'}</h3>
      {active ? (
        <>
          <p className="muted">Loại: {CSD_CHAT_KIND_LABELS[active.kind] ?? active.kind}</p>
          <p className="muted">Tài khoản: {active.client_account_id ?? '—'}</p>
          {active.kind === 'project' ? (
            <p className="muted">
              Dự án: {active.project_ref_kind ?? '—'} / {active.project_ref_id ?? '—'}
            </p>
          ) : null}
          <p className="muted">Trạng thái: {archived ? 'Lưu trữ' : closed ? 'Đã đóng' : active.status ?? 'active'}</p>
          {!isSheet && canWrite && !closed && !archived ? (
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onClose}>
              Đóng hội thoại
            </button>
          ) : null}
          {!isSheet && canWrite && !archived ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={onArchive}
              data-testid="csd-chat-archive"
            >
              Lưu trữ
            </button>
          ) : null}

          <h4 className="kpi-section-title">Ticket liên quan</h4>
          <ul className="csd-chat-related" data-testid="csd-chat-related-tickets">
            {relatedTickets.length === 0 ? (
              <li className="muted">Chưa có ticket</li>
            ) : (
              relatedTickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/crm/csd/tickets/${t.id}`} className="csd-chat-ticket-pill">
                    {t.code} · {t.priority} · {t.status}
                  </Link>
                  <span className="muted">{t.title}</span>
                </li>
              ))
            )}
          </ul>

          <h4 className="kpi-section-title">Thành viên</h4>
          <ul className="csd-chat-members" data-testid="csd-chat-members">
            {members.length === 0 ? (
              <li className="muted">Chưa có thành viên</li>
            ) : (
              members.map((m) => (
                <li key={`${m.conversation_id}-${m.member_staff_id}`}>
                  Staff #{m.member_staff_id} · {m.role === 'owner' ? 'Chủ' : m.role}
                  {canWrite && m.role !== 'owner' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
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
                className="kpi-input"
                inputMode="numeric"
                placeholder="Staff id"
                value={memberStaffId}
                onChange={(e) => onMemberStaffId(e.target.value)}
                data-testid="csd-chat-member-id"
              />
              <button type="submit" className="btn btn-sm" disabled={busy || !memberStaffId.trim()}>
                Thêm
              </button>
            </form>
          ) : null}

          {isSheet ? null : <h4 className="kpi-section-title">Tóm tắt AI</h4>}
          {isSheet ? null : (
          <div className="csd-chat-ai-period">
            {(['24h', '7d', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm btn-secondary${aiPeriod === p ? ' is-active' : ''}`}
                onClick={() => onAiPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          )}
          {isSheet ? null : (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={onSummarize}
            data-testid="csd-chat-ai-summary"
          >
            Tóm tắt AI
          </button>
          )}
          {!isSheet && aiSummary ? (
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
                <p className="muted">—</p>
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
                          className="btn btn-sm btn-secondary"
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
        </>
      ) : (
        <p className="muted">Chọn hội thoại để xem ngữ cảnh</p>
      )}
    </aside>
  );
}

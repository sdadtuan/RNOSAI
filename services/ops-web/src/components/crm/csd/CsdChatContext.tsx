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

type AiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
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
  onMemberStaffId: (value: string) => void;
  onAddMember: () => void;
  onRemoveMember: (staffId: number) => void;
  onClose: () => void;
  onAiPeriod: (period: '24h' | '7d' | 'all') => void;
  onSummarize: () => void;
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
  onMemberStaffId,
  onAddMember,
  onRemoveMember,
  onClose,
  onAiPeriod,
  onSummarize,
}: CsdChatContextProps) {
  return (
    <aside className="csd-chat-workspace__context page-card stack-gap">
      <h3 className="kpi-section-title">Ngữ cảnh</h3>
      {active ? (
        <>
          <p className="muted">Loại: {CSD_CHAT_KIND_LABELS[active.kind] ?? active.kind}</p>
          <p className="muted">Tài khoản: {active.client_account_id ?? '—'}</p>
          {active.kind === 'project' ? (
            <p className="muted">
              Dự án: {active.project_ref_kind ?? '—'} / {active.project_ref_id ?? '—'}
            </p>
          ) : null}
          <p className="muted">Trạng thái: {closed ? 'Đã đóng' : active.status ?? 'active'}</p>
          {canWrite && !closed ? (
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onClose}>
              Đóng hội thoại
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
          {canWrite && !closed ? (
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

          <h4 className="kpi-section-title">Tóm tắt AI</h4>
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
          <button
            type="button"
            className="btn btn-sm"
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
                <br />
                {aiSummary.actions.join(' · ') || '—'}
              </p>
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

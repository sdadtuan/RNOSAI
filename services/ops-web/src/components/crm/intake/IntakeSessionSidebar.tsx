'use client';

import type { IntakeSessionRow } from '@/lib/api';
import {
  INTAKE_DECISION_OPTIONS,
  intakeModeLabel,
  intakeStatusLabel,
} from '@/lib/crm/intake-labels';
import { sortIntakeSessions } from '@/lib/crm/intake-session-form';

function decisionLabel(value: string): string {
  if (!value) return '—';
  return INTAKE_DECISION_OPTIONS.find((d) => d.value === value)?.label ?? value;
}

interface Props {
  sessions: IntakeSessionRow[];
  activeId: number | null;
  saving: boolean;
  canCreate: boolean;
  systemSessionCount?: number | null;
  onSelect: (session: IntakeSessionRow) => void;
  onCreatePhone: () => void;
  onCreateInPerson: () => void;
}

export function IntakeSessionSidebar({
  sessions,
  activeId,
  saving,
  canCreate,
  systemSessionCount,
  onSelect,
  onCreatePhone,
  onCreateInPerson,
}: Props) {
  const sorted = sortIntakeSessions(sessions);
  const activeSession = sorted.find((s) => s.id === activeId) ?? null;

  return (
    <div className="intake-sidebar">
      <div className="intake-sidebar__head">
        <strong>Phiên khảo sát</strong>
        {sessions.length > 0 ? (
          <span className="muted intake-sidebar__meta">
            {sessions.length} phiên
            {activeSession ? ` · BANT ${activeSession.bant_total ?? 0}/30` : ''}
          </span>
        ) : (
          <span className="muted intake-sidebar__meta">Chưa có phiên</span>
        )}
      </div>

      {canCreate ? (
        <div className="intake-sidebar__actions">
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving}
            onClick={onCreatePhone}
          >
            + Gọi điện
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={saving}
            onClick={onCreateInPerson}
          >
            + Gặp trực tiếp
          </button>
        </div>
      ) : null}

      <ul className="intake-sidebar__list" aria-label="Danh sách phiên khảo sát">
        {sorted.map((session) => {
          const isActive = session.id === activeId;
          return (
            <li key={session.id}>
              <button
                type="button"
                className={`intake-sidebar__item${isActive ? ' intake-sidebar__item--active' : ''}`}
                onClick={() => onSelect(session)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="intake-sidebar__item-title">
                  Phiên #{session.id}
                  {session.status === 'draft' ? (
                    <span className="intake-sidebar__badge intake-sidebar__badge--draft">Nháp</span>
                  ) : null}
                </span>
                <span className="intake-sidebar__item-meta muted">
                  {intakeModeLabel(session.mode)} · {intakeStatusLabel(session.status)}
                </span>
                <span className="intake-sidebar__item-meta muted">
                  BANT {session.bant_total ?? 0}/30 · {decisionLabel(session.decision)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {sessions.length === 0 ? (
        <p className="muted intake-sidebar__empty">Tạo phiên gọi điện hoặc gặp trực tiếp để bắt đầu.</p>
      ) : null}

      {systemSessionCount != null ? (
        <p className="muted intake-sidebar__foot">Tổng hệ thống: {systemSessionCount} phiên</p>
      ) : null}
    </div>
  );
}

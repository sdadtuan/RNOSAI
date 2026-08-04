'use client';

import Link from 'next/link';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';

export interface IntakeConsultGateState {
  ok: boolean;
  level: string;
  messages: string[];
  requires_confirm: boolean;
  requires_override: boolean;
  decision?: string;
  bant_total?: number;
}

interface Props {
  leadId: number;
  gate: IntakeConsultGateState;
  loading?: boolean;
  onRefresh?: () => void;
}

function decisionLabel(value: string | undefined): string {
  if (!value) return '—';
  return INTAKE_DECISION_OPTIONS.find((d) => d.value === value)?.label ?? value;
}

function gateTone(gate: IntakeConsultGateState): 'ok' | 'warn' | 'block' {
  if (gate.level === 'warn') return 'warn';
  if (gate.level === 'block' || !gate.ok) return 'block';
  return 'ok';
}

export function IntakeConsultGateBanner({ leadId, gate, loading, onRefresh }: Props) {
  const tone = gateTone(gate);
  const title =
    tone === 'ok'
      ? 'Sẵn sàng chuyển Tư vấn "Consult"'
      : tone === 'warn'
        ? 'Cần xem xét trước Tư vấn "Consult"'
        : 'Chưa đủ điều kiện Tư vấn "Consult"';

  return (
    <section
      className={`intake-gate-banner intake-gate-banner--${tone}`}
      aria-live="polite"
      aria-label='Cổng chuyển Tư vấn "Consult gate"'
    >
      <div className="intake-gate-banner__head">
        <strong>{title}</strong>
        <div className="intake-gate-banner__actions">
          {onRefresh ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={onRefresh}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          ) : null}
          <Link href={`/crm/leads/${leadId}`} className="nav-link">
            Quay lead →
          </Link>
        </div>
      </div>
      {gate.messages.length > 0 ? (
        <ul className="intake-gate-banner__messages">
          {gate.messages.map((m) => (
            <li key={m}>
              {m.includes('task Lead') ? (
                <>
                  {m} — mở{' '}
                  <Link href={`/crm/leads/${leadId}`} className="nav-link">
                    Lead #{leadId}
                  </Link>{' '}
                  → Pre-sales → tick ✓ task giai đoạn Lead, hoặc bấm <strong>Làm mới</strong> sau khi
                  Intake Go đã hoàn thành.
                </>
              ) : (
                m
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {gate.bant_total != null || gate.decision ? (
        <p className="muted intake-gate-banner__meta">
          BANT {gate.bant_total ?? '—'}/30 · Quyết định: {decisionLabel(gate.decision)}
          {gate.requires_override ? ' · Cần Director override' : ''}
          {gate.requires_confirm ? ' · Cần xác nhận' : ''}
        </p>
      ) : null}
    </section>
  );
}

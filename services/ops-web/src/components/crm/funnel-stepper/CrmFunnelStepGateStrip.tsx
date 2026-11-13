'use client';

import Link from 'next/link';
import type { FunnelGateStripViewModel } from '@/lib/crm/funnel-stepper.types';

interface Props {
  leadId: number;
  gateStrip: FunnelGateStripViewModel;
  loading?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
}

export function CrmFunnelStepGateStrip({ leadId, gateStrip, loading, onRefresh, onEdit }: Props) {
  const tone = gateStrip.tone;
  const isProposal = gateStrip.gateKind === 'proposal';
  const editable = Boolean(onEdit) && !isProposal;
  const metaBits = [
    gateStrip.requiresOverride ? 'Cần Director override' : '',
    gateStrip.requiresConfirm ? 'Cần xác nhận' : '',
    editable ? 'Bấm để mở Sales Discovery' : '',
  ].filter(Boolean);

  return (
    <section
      className={`intake-gate-banner intake-gate-banner--${tone} crm-funnel-stepper__gate${
        editable ? ' intake-gate-banner--editable' : ''
      }`}
      aria-live="polite"
      aria-label={
        isProposal ? 'Cổng chuyển Chờ báo giá' : 'Cổng Submit to AM (Chờ Solutions)'
      }
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onClick={editable ? onEdit : undefined}
      onKeyDown={
        editable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEdit?.();
              }
            }
          : undefined
      }
    >
      <div className="intake-gate-banner__head">
        <strong>{gateStrip.title}</strong>
        {onRefresh ? (
          <div className="intake-gate-banner__actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={(event) => {
                event.stopPropagation();
                onRefresh?.();
              }}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        ) : null}
      </div>
      {gateStrip.messages.length > 0 ? (
        <ul className="intake-gate-banner__messages">
          {gateStrip.messages.map((m) => (
            <li key={m}>
              {m.includes('task Lead') ? (
                <>
                  {m} — mở{' '}
                  <Link href={`/crm/leads/${leadId}#funnel-presales`} className="nav-link">
                    Lead #{leadId}
                  </Link>{' '}
                  → Pre Sale → hoàn thành bước, hoặc bấm <strong>Làm mới</strong> sau khi
                  Sales Discovery đã nộp.
                </>
              ) : m.includes('Consult') || m.includes('KH MKT') || m.includes('kế hoạch') ? (
                <>
                  {m}
                  {gateStrip.scrollAnchor ? (
                    <>
                      {' '}
                      —{' '}
                      <a href={gateStrip.scrollAnchor} className="nav-link">
                        Điền form bên dưới ↓
                      </a>
                    </>
                  ) : null}
                </>
              ) : (
                m
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {metaBits.length > 0 ? (
        <p className="muted intake-gate-banner__meta">{metaBits.join(' · ')}</p>
      ) : null}
    </section>
  );
}

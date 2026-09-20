'use client';

import Link from 'next/link';
import { CATALOG_SERVICE_SLUGS, gapToConsultLabel, intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
import { winConsultLabel } from '@/lib/crm/intake-win-coverage';

export type IntakeDealBarProps = {
  leadName: string;
  companyName: string | null;
  industry: string | null;
  serviceSlug: string;
  serviceLabel: string;
  bantTotal: number;
  winTotal: number;
  gap: number;
  stage: string | null;
  sciExcerpt: string | null;
  leadHref: string;
  cockpitHref: string;
  canEdit: boolean;
  sessionCompleted?: boolean;
  slugMismatch: boolean;
  funnelCollapsed: boolean;
  onToggleFunnel: () => void;
  onServiceChange: (slug: string) => void;
  onReopenService?: () => void;
  showSalesKit?: boolean;
  salesKitOpen?: boolean;
  onOpenSalesKit?: () => void;
  bantOpen?: boolean;
  onOpenBant?: () => void;
  winOpen?: boolean;
  onOpenWin?: () => void;
  decisionOpen?: boolean;
  onOpenDecision?: () => void;
  decisionLabel?: string | null;
};

function sciLine(excerpt: string | null): string {
  const text = excerpt?.trim() ?? '';
  if (!text) return 'SCI chưa sẵn';
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function IntakeDealBar({
  leadName,
  companyName,
  industry,
  serviceSlug,
  serviceLabel,
  bantTotal,
  winTotal,
  gap,
  stage,
  sciExcerpt,
  leadHref,
  cockpitHref,
  canEdit,
  sessionCompleted = false,
  slugMismatch,
  funnelCollapsed,
  onToggleFunnel,
  onServiceChange,
  onReopenService,
  showSalesKit = false,
  salesKitOpen = false,
  onOpenSalesKit,
  bantOpen = false,
  onOpenBant,
  winOpen = false,
  onOpenWin,
  decisionOpen = false,
  onOpenDecision,
  decisionLabel = null,
}: IntakeDealBarProps) {
  const gapLabel = gapToConsultLabel(gap);
  const showCompletedService = sessionCompleted || !canEdit;

  return (
    <section className="intake-deal-bar" aria-label="Deal Bar">
      <div className="intake-deal-bar__identity">
        <strong className="intake-deal-bar__name">{leadName || '—'}</strong>
        {companyName?.trim() ? (
          <span className="intake-deal-bar__meta">{companyName.trim()}</span>
        ) : null}
        <span className={`intake-deal-bar__chip${industry?.trim() ? '' : ' intake-deal-bar__chip--muted'}`}>
          {industry?.trim() || 'Chưa có ngành'}
        </span>
        <div className="intake-deal-bar__service">
          <span className="muted">
            Dịch vụ
            <span className="intake-required-mark" title="Bắt buộc trước khi hoàn thành / qua Tư vấn">
              *
            </span>
          </span>
          {showCompletedService ? (
            <span className="intake-deal-bar__service-locked">
              <strong>{intakeServiceLabel(serviceSlug) || serviceLabel}</strong>
              {onReopenService ? (
                <button type="button" className="btn btn-sm btn-secondary" onClick={onReopenService}>
                  Đổi (Reopen)
                </button>
              ) : null}
            </span>
          ) : (
            <select
              className="kpi-select intake-deal-bar__select"
              value={serviceSlug}
              aria-label={`${serviceLabel} (bắt buộc)`}
              onChange={(e) => onServiceChange(e.target.value)}
            >
              <option value="_common">{intakeServiceLabel('_common')}</option>
              {CATALOG_SERVICE_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {intakeServiceLabel(slug)}
                </option>
              ))}
            </select>
          )}
        </div>
        <span className="intake-deal-bar__scores">
          <span className="intake-deal-bar__score">
            BANT {bantTotal}/30 · {gapLabel}
          </span>
          <span className="intake-deal-bar__score">
            Win {winTotal}/30 · {winConsultLabel(winTotal)}
          </span>
        </span>
        <span className="intake-deal-bar__chip intake-deal-bar__chip--muted">
          {stage?.trim() || '—'}
        </span>
      </div>

      <p className="intake-deal-bar__sci muted">{sciLine(sciExcerpt)}</p>

      {slugMismatch ? (
        <p className="intake-deal-bar__mismatch">
          Slug phiên khác funnel.{' '}
          <Link href={leadHref} className="nav-link">
            Đồng bộ trên lead →
          </Link>
        </p>
      ) : null}

      <div className="intake-deal-bar__cta">
        <Link href={leadHref} className="btn btn-secondary btn-sm">
          ← Lead
        </Link>
        <Link href={cockpitHref} className="btn btn-secondary btn-sm">
          Cockpit
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={bantOpen}
          aria-controls="intake-bant-checklist"
          onClick={onOpenBant}
        >
          BANT
        </button>
        <button
          type="button"
          className={`btn btn-secondary btn-sm${decisionLabel ? '' : ' intake-deal-bar__cta--alert'}`}
          aria-expanded={decisionOpen}
          aria-controls="intake-decision-panel"
          onClick={onOpenDecision}
        >
          Quyết định{decisionLabel ? ` · ${decisionLabel}` : ' *'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={winOpen}
          aria-controls="intake-win-checklist"
          onClick={onOpenWin}
        >
          WIN
        </button>
        {showSalesKit ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-expanded={salesKitOpen}
            aria-controls="intake-sales-kit"
            onClick={onOpenSalesKit}
          >
            Sales Kit
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={!funnelCollapsed}
          onClick={onToggleFunnel}
        >
          Funnel {funnelCollapsed ? '▾' : '▴'}
        </button>
      </div>
    </section>
  );
}

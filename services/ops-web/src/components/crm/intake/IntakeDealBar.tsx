'use client';

import Link from 'next/link';
import { CATALOG_SERVICE_SLUGS, gapToConsultLabel, intakeServiceLabel } from '@/lib/crm/intake-service-resolve';

export type IntakeDealBarProps = {
  leadName: string;
  companyName: string | null;
  industry: string | null;
  serviceSlug: string;
  serviceLabel: string;
  bantTotal: number;
  gap: number;
  stage: string | null;
  sciExcerpt: string | null;
  leadHref: string;
  cockpitHref: string;
  canEdit: boolean;
  slugMismatch: boolean;
  funnelCollapsed: boolean;
  onToggleFunnel: () => void;
  onServiceChange: (slug: string) => void;
  showSalesKit?: boolean;
  salesKitOpen?: boolean;
  onOpenSalesKit?: () => void;
  bantOpen?: boolean;
  onOpenBant?: () => void;
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
  gap,
  stage,
  sciExcerpt,
  leadHref,
  cockpitHref,
  canEdit,
  slugMismatch,
  funnelCollapsed,
  onToggleFunnel,
  onServiceChange,
  showSalesKit = false,
  salesKitOpen = false,
  onOpenSalesKit,
  bantOpen = false,
  onOpenBant,
}: IntakeDealBarProps) {
  const gapLabel = gapToConsultLabel(gap);

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
        <label className="intake-deal-bar__service">
          <span className="muted">Dịch vụ</span>
          <select
            className="kpi-select intake-deal-bar__select"
            value={serviceSlug}
            disabled={!canEdit}
            aria-label={serviceLabel}
            onChange={(e) => onServiceChange(e.target.value)}
          >
            <option value="_common">{intakeServiceLabel('_common')}</option>
            {CATALOG_SERVICE_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {intakeServiceLabel(slug)}
              </option>
            ))}
          </select>
        </label>
        <span className="intake-deal-bar__score">
          BANT {bantTotal}/30 · {gapLabel}
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

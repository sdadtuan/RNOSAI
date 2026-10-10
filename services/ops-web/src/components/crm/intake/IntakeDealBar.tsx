'use client';

import Link from 'next/link';
import { CATALOG_SERVICE_SLUGS, gapToConsultLabel, intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
import { winConsultLabel } from '@/lib/crm/intake-win-coverage';

export type IntakeDealBarProps = {
  leadName: string;
  companyName: string | null;
  industry: string | null;
  industrySlug?: string | null;
  industryOptions?: Array<{ slug: string; name: string }>;
  serviceSlug: string;
  serviceLabel: string;
  serviceOptions?: Array<{ slug: string; name: string }>;
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
  onIndustryChange?: (slug: string) => void;
  onOpenServiceCatalog?: () => void;
  serviceItemCount?: number;
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
  industrySlug = '',
  industryOptions = [],
  serviceSlug,
  serviceLabel,
  serviceOptions = [],
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
  onIndustryChange,
  onOpenServiceCatalog,
  serviceItemCount = 0,
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
  const industryChoices = industryOptions.filter((row) => row.slug && row.name);
  const catalogServices = serviceOptions.filter((row) => row.slug && row.name);
  const serviceChoices =
    catalogServices.length > 0
      ? catalogServices
      : CATALOG_SERVICE_SLUGS.map((slug) => ({ slug, name: intakeServiceLabel(slug) }));
  const industryValue = industrySlug?.trim() || '';
  const industryName =
    industryChoices.find((row) => row.slug === industryValue)?.name || industry?.trim() || '';

  return (
    <section className="intake-deal-bar" aria-label="Deal Bar">
      <div className="intake-deal-bar__identity">
        <strong className="intake-deal-bar__name">{leadName || '—'}</strong>
        {companyName?.trim() ? (
          <span className="intake-deal-bar__meta">{companyName.trim()}</span>
        ) : null}
        {showCompletedService ? (
          <span className={`intake-deal-bar__chip${industryName ? '' : ' intake-deal-bar__chip--muted'}`}>
            {industryName || 'Chưa có ngành'}
          </span>
        ) : (
          <select
            className="kpi-select intake-deal-bar__select"
            aria-label="Ngành"
            value={industryValue}
            onChange={(e) => onIndustryChange?.(e.target.value)}
          >
            <option value="">Chưa có ngành</option>
            {industryName && !industryChoices.some((row) => row.slug === industryValue) ? (
              <option value={industryValue || industryName}>{industryName}</option>
            ) : null}
            {industryChoices.map((row) => (
              <option key={row.slug} value={row.slug}>
                {row.name}
              </option>
            ))}
          </select>
        )}
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
              {serviceSlug &&
              serviceSlug !== '_common' &&
              !serviceChoices.some((row) => row.slug === serviceSlug) ? (
                <option value={serviceSlug}>{serviceLabel || intakeServiceLabel(serviceSlug)}</option>
              ) : null}
              {serviceChoices.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.name}
                </option>
              ))}
            </select>
          )}
          {onOpenServiceCatalog && serviceSlug && serviceSlug !== '_common' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenServiceCatalog}>
              {serviceItemCount > 0 ? `Hạng mục · ${serviceItemCount}` : 'Hạng mục'}
            </button>
          ) : null}
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

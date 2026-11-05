'use client';

import Link from 'next/link';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import type { RenewalPortfolioSummary } from '@/lib/ai-api';
import type { CskhHomeSummary } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import { canSeeQtNav } from '@/lib/crm/qt-nav.util';

function toneClass(count: number, warnAbove = 0): string {
  if (count <= warnAbove) return 'win-home-tile--ok';
  return 'win-home-tile--alert';
}

export function WinHomeDashboard({
  user,
  summary,
  renewal,
  loading,
  error,
}: {
  user: StoredStaffUser;
  summary: CskhHomeSummary | null;
  renewal?: RenewalPortfolioSummary | null;
  loading: boolean;
  error: string;
}) {
  const canLeads = hasCap(user, 'crm_leads', 'view');
  const canHub = hasCap(user, 'crm_agency', 'view') || hasCap(user, 'crm_hub_contracts', 'view');
  const mineScope = summary?.scope === 'mine';
  const showReview = summary?.review_queue.visible !== false && !mineScope;
  const showAi = aiCopilotEnabled() && summary?.ai && !mineScope;
  const solCaps = resolvePresalesSolutionCaps(user);
  const firstName = (user.display_name || user.email || '').split(/\s+/).slice(-1)[0] || 'bạn';

  if (loading && !summary) {
    return <p className="muted">Đang tải bảng điều khiển…</p>;
  }
  if (error && !summary) {
    return <p className="error">{error}</p>;
  }
  if (!summary || !canLeads) {
    return (
      <div className="win-home">
        <p className="muted">Không có widget — cần quyền xem leads.</p>
      </div>
    );
  }

  return (
    <div className="win-home" data-testid="win-home-dashboard">
      <header className="win-home__header">
        <div>
          <p className="win-home__eyebrow">{mineScope ? 'Bàn làm việc AE' : 'Vận hành CRM'}</p>
          <h2 className="win-home__title">
            {mineScope ? `Xin chào, ${firstName}` : 'Bảng điều khiển'}
          </h2>
          <p className="win-home__subtitle">
            {mineScope
              ? 'Chỉ số liệu lead được giao cho bạn — không thấy lead AE khác.'
              : 'Tổng quan SLA, review queue và tín hiệu vận hành.'}
          </p>
        </div>
        {mineScope ? <span className="win-home__scope">Lead của tôi</span> : null}
      </header>

      <div className={`win-home__grid${mineScope ? ' win-home__grid--ae' : ''}`}>
        <Link
          href={mineScope ? '/crm/b2b/leads' : '/crm/leads?status=moi'}
          className="win-home-tile"
        >
          <span className="win-home-tile__label">
            {mineScope ? 'Lead mới hôm nay' : 'Lead Meta mới hôm nay'}
          </span>
          <strong className="win-home-tile__value">{summary.leads_new_today}</strong>
          <span className="win-home-tile__hint">
            {mineScope ? 'Trong pipeline B2B của bạn' : 'Meta / client active · ICT'}
          </span>
        </Link>

        <Link
          href={summary.sla.drill_href}
          className={`win-home-tile ${toneClass(summary.sla.breach_count)}`}
        >
          <span className="win-home-tile__label">SLA breach</span>
          <strong className="win-home-tile__value">{summary.sla.breach_count}</strong>
          <span className="win-home-tile__hint">
            {mineScope
              ? summary.sla.breach_count === 0
                ? 'Không có lead của bạn trễ SLA'
                : 'Lead của bạn đang trễ — mở Kanban'
              : `Warning ${summary.sla.warning_count}${
                  summary.sla.compliance_pct != null ? ` · ${summary.sla.compliance_pct}%` : ''
                }`}
          </span>
        </Link>

        {showReview ? (
          <Link
            href={summary.review_queue.drill_href}
            className={`win-home-tile ${toneClass(summary.review_queue.pending_count)}`}
          >
            <span className="win-home-tile__label">Review queue</span>
            <strong className="win-home-tile__value">{summary.review_queue.pending_count}</strong>
            <span className="win-home-tile__hint">
              {summary.review_queue.max_age_hours != null
                ? `Max chờ ${summary.review_queue.max_age_hours}h`
                : 'Không có lead chờ'}
            </span>
          </Link>
        ) : mineScope ? (
          <Link href="/crm/solution/queue" className="win-home-tile">
            <span className="win-home-tile__label">Theo dõi Solution</span>
            <strong className="win-home-tile__value">→</strong>
            <span className="win-home-tile__hint">Lead đã giao Solution / AM trả lại</span>
          </Link>
        ) : null}

        {showAi && summary.ai ? (
          <Link href={summary.ai.drill_href} className="win-home-tile">
            <span className="win-home-tile__label">Copilot DAU (7 ngày)</span>
            <strong className="win-home-tile__value">
              {summary.ai.copilot_dau_pct != null ? `${summary.ai.copilot_dau_pct}%` : '—'}
            </strong>
            <span className="win-home-tile__hint">
              {summary.ai.copilot_dau_latest}/{summary.ai.pilot_denominator} pilot
            </span>
          </Link>
        ) : null}

        {renewal && renewal.t90_count + renewal.t60_count + renewal.t30_count > 0 ? (
          <Link
            href={renewal.drill_href}
            className="win-home-tile win-home-tile--alert"
            data-testid="renewal-t90-strip"
          >
            <span className="win-home-tile__label">Renewal T-90</span>
            <strong className="win-home-tile__value">{renewal.t90_count}</strong>
            <span className="win-home-tile__hint">
              T-60 {renewal.t60_count} · T-30 {renewal.t30_count}
            </span>
          </Link>
        ) : null}
      </div>

      <nav className="win-home__actions" aria-label="Lối tắt">
        <Link href="/crm/b2b/leads" className="btn btn-sm">
          Lead B2B
        </Link>
        {solCaps.canView ? (
          <Link href="/crm/solution/queue" className="btn btn-sm btn-ghost">
            {solCaps.isAeTrackOnly ? 'Theo dõi Solution' : 'Hàng đợi Solution'}
          </Link>
        ) : null}
        {canSeeQtNav(user) ? (
          <Link href="/crm/proposals" className="btn btn-sm btn-ghost">
            Báo giá
          </Link>
        ) : null}
        {canHub ? (
          <Link href="/crm/hub" className="btn btn-sm btn-ghost">
            Hub hợp đồng
          </Link>
        ) : null}
        {!mineScope ? (
          <Link href="/crm/cskh-board" className="btn btn-sm btn-ghost">
            CSKH
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

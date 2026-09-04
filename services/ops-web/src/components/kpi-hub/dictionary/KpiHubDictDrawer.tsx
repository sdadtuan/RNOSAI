'use client';

import Link from 'next/link';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { ownerInitials } from '@/lib/kpi-hub-dictionary-utils';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';
import { KpiHubSourceChips } from './KpiHubSourceChips';

type Props = {
  row: KpiHubDictionaryRow | null;
  loading?: boolean;
  onClose: () => void;
};

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

export function KpiHubDictDrawer({ row, loading, onClose }: Props) {
  if (!row) {
    return (
      <aside className="kpi-hub-drawer kpi-hub-dict-drawer kpi-hub-dict-drawer--empty" aria-label="Chi tiết KPI">
        <p>Chọn một KPI trên bảng để xem mô tả, công thức, nguồn dữ liệu và mục tiêu.</p>
      </aside>
    );
  }

  const ownerName = row.dataOwnerRole ?? row.dataOwner;
  const ownerEmail = row.dataOwnerEmail;
  const hasFormula = Boolean(row.numeratorLabel || row.denominatorLabel || row.formulaDisplay);

  return (
    <aside className="kpi-hub-drawer kpi-hub-dict-drawer" aria-label={`Chi tiết ${row.name}`}>
      <header className="kpi-hub-dict-drawer__head">
        <div className="kpi-hub-dict-drawer__head-row">
          <span className="kpi-hub-dict-drawer__icon" aria-hidden>
            <ChartIcon />
          </span>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="kpi-hub-dict-drawer__title-row">
          <h2>{row.name}</h2>
          <KpiHubStatusBadge kind="dict" status={row.status} />
        </div>
        <div className="kpi-hub-dict-drawer__id-box">
          <span>KPI ID</span>
          <strong>{row.code}</strong>
        </div>
      </header>

      <div className="kpi-hub-drawer__body kpi-hub-dict-drawer__body">
        {loading ? (
          <div className="kpi-hub-dict-drawer__loading">
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line" />
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line" />
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
          </div>
        ) : (
          <>
            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Mô tả</h3>
              <p className="kpi-hub-dict-drawer__text">{row.description || '—'}</p>
            </section>

            {hasFormula ? (
              <section className="kpi-hub-dict-drawer__section">
                <h3 className="kpi-hub-dict-drawer__label">Công thức</h3>
                <div className="kpi-hub-dict-drawer__formula-box">
                  {row.numeratorLabel || row.denominatorLabel ? (
                    <>
                      <div className="kpi-hub-dict-drawer__formula-num">{row.numeratorLabel ?? '—'}</div>
                      <div className="kpi-hub-dict-drawer__formula-divider" aria-hidden />
                      <div className="kpi-hub-dict-drawer__formula-den">{row.denominatorLabel ?? '—'}</div>
                    </>
                  ) : (
                    <div className="kpi-hub-dict-drawer__formula-num">{row.formulaDisplay}</div>
                  )}
                </div>
              </section>
            ) : null}

            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Nguồn dữ liệu</h3>
              <KpiHubSourceChips source={row.source} sources={row.sources} max={6} tone="drawer" />
            </section>

            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Tần suất</h3>
              <p className="kpi-hub-dict-drawer__text">{row.frequency || '—'}</p>
            </section>

            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Data Owner</h3>
              <div className="kpi-hub-dict-drawer__owner">
                <span className="kpi-hub-dict-drawer__owner-avatar" aria-hidden>
                  {ownerInitials(ownerName)}
                </span>
                <div>
                  <strong>{ownerName}</strong>
                  {ownerEmail ? <p className="kpi-hub-dict-drawer__owner-email">{ownerEmail}</p> : null}
                </div>
              </div>
            </section>

            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Mục tiêu</h3>
              {row.targetLabel ? (
                <div className="kpi-hub-dict-drawer__target-card">
                  <strong className="kpi-hub-dict-drawer__target-value">{row.targetLabel}</strong>
                  {row.targetDescription ? (
                    <p className="kpi-hub-dict-drawer__target-desc">{row.targetDescription}</p>
                  ) : null}
                </div>
              ) : (
                <p className="kpi-hub-dict-drawer__text">Chưa đặt mục tiêu.</p>
              )}
            </section>

            <section className="kpi-hub-dict-drawer__section">
              <h3 className="kpi-hub-dict-drawer__label">Cập nhật lần cuối</h3>
              <p className="kpi-hub-dict-drawer__updated">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {row.updatedAtLabel ?? '—'}
              </p>
            </section>
          </>
        )}
      </div>

      <footer className="kpi-hub-drawer__foot">
        <Link href={`/crm/kpi-hub/dictionary/${row.id}/edit`} className="kpi-hub-dict-drawer__edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Chỉnh sửa KPI
        </Link>
      </footer>
    </aside>
  );
}

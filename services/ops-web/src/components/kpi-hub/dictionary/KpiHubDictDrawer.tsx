'use client';

import Link from 'next/link';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  row: KpiHubDictionaryRow | null;
  onClose: () => void;
};

export function KpiHubDictDrawer({ row, onClose }: Props) {
  if (!row) return null;

  return (
    <aside className="kpi-hub-drawer" aria-label="Chi tiết KPI">
      <header className="kpi-hub-drawer__head">
        <div>
          <h2>{row.name}</h2>
          <span className="kpi-hub-table__mono">{row.code}</span>
        </div>
        <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </header>
      <div className="kpi-hub-drawer__body">
        <KpiHubStatusBadge kind="dict" status={row.status} />
        {row.formulaDisplay ? (
          <div className="kpi-hub-drawer__formula">
            <span className="muted">Công thức</span>
            <p>{row.numeratorLabel ?? '—'} / {row.denominatorLabel ?? '—'}</p>
            <p className="kpi-hub-drawer__formula-expr">{row.formulaDisplay}</p>
          </div>
        ) : null}
        {row.targetLabel ? (
          <div className="kpi-hub-drawer__target">
            <span className="muted">Target</span>
            <strong>{row.targetLabel}</strong>
          </div>
        ) : null}
        <dl className="kpi-hub-drawer__dl">
          <div>
            <dt>Nguồn</dt>
            <dd>{row.source}</dd>
          </div>
          <div>
            <dt>Tần suất</dt>
            <dd>{row.frequency}</dd>
          </div>
          <div>
            <dt>Data Owner</dt>
            <dd>{row.dataOwner}</dd>
          </div>
        </dl>
      </div>
      <footer className="kpi-hub-drawer__foot">
        <Link href={`/crm/kpi-hub/dictionary/${row.id}/edit`} className="kpi-hub-btn kpi-hub-btn--primary">
          Chỉnh sửa KPI
        </Link>
      </footer>
    </aside>
  );
}

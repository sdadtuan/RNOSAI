'use client';

import Link from 'next/link';
import type { TowerException } from '@/lib/crm/ceo-tower-api';
import { mapTowerSuggestAction } from '@/lib/crm/ceo-tower-suggest.util';
import { towerColumnLabel } from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerExceptionQueueProps = {
  exceptions: TowerException[];
  canAct: boolean | null;
  busy: boolean;
  outsideCycleActive: boolean;
  emptyCopy: string;
  outsideCycleCopy: string;
  onOwnerFilter: (staffId: number) => void;
  onSuggest: (row: TowerException) => void;
};

function severityLabel(sev: TowerException['severity']): string {
  if (sev === 'red') return 'Đỏ';
  if (sev === 'amber') return 'Vàng';
  return 'Ổn';
}

export function CeoTowerExceptionQueue({
  exceptions,
  canAct,
  busy,
  outsideCycleActive,
  emptyCopy,
  outsideCycleCopy,
  onOwnerFilter,
  onSuggest,
}: CeoTowerExceptionQueueProps) {
  if (outsideCycleActive) {
    return (
      <p className="ceo-tower-queue-empty" data-testid="ceo-tower-outside-cycle-empty">
        {outsideCycleCopy}
      </p>
    );
  }

  if (exceptions.length === 0) {
    return <p className="ceo-tower-queue-empty">{emptyCopy}</p>;
  }

  return (
    <ul className="ceo-tower-queue-grid">
      {exceptions.map((row) => (
        <li
          key={`${row.entity_type}-${row.entity_id}-${row.column_id}-${row.title_vi}`}
          className={`ceo-tower-queue-card ceo-tower-queue-card--${row.severity}`}
          data-testid={`ceo-tower-queue-row-${row.entity_id}`}
        >
          <div className="ceo-tower-queue-card__head">
            <span className={`ceo-tower-queue-card__sev ceo-tower-queue-card__sev--${row.severity}`}>
              {severityLabel(row.severity)}
            </span>
            <span className="ceo-tower-queue-card__factory">{row.factory}</span>
            <span className="ceo-tower-queue-card__column">{towerColumnLabel(row.column_id)}</span>
          </div>
          <p className="ceo-tower-queue-card__title">{row.title_vi}</p>
          <div className="ceo-tower-queue-card__meta">
            <span>{row.age_label}</span>
            {row.owner_staff_id ? (
              <button
                type="button"
                className="ceo-tower-queue-card__owner"
                onClick={() => onOwnerFilter(row.owner_staff_id!)}
              >
                {row.owner_name || `#${row.owner_staff_id}`}
              </button>
            ) : (
              <span className="muted">{row.owner_name || 'Chưa có owner'}</span>
            )}
          </div>
          <div className="ceo-tower-queue-card__actions">
            <Link href={row.href} className="btn btn-sm btn-secondary">
              Mở
            </Link>
            <SuggestActionButton row={row} canAct={canAct} busy={busy} onSuggest={() => onSuggest(row)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SuggestActionButton({
  row,
  canAct,
  busy,
  onSuggest,
}: {
  row: TowerException;
  canAct: boolean | null;
  busy: boolean;
  onSuggest: () => void;
}) {
  if (canAct === false) return null;
  if (canAct === null) {
    return (
      <button type="button" className="btn btn-sm btn-ghost" disabled title="Đang kiểm tra quyền…">
        Gợi ý
      </button>
    );
  }
  const mapped = mapTowerSuggestAction(row, { can_act: true });
  if (mapped.kind === 'hidden') return null;
  if (mapped.kind === 'upcoming') {
    return (
      <button type="button" className="btn btn-sm btn-ghost" disabled title={mapped.tooltip}>
        Gợi ý
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={onSuggest}>
      Gợi ý
    </button>
  );
}

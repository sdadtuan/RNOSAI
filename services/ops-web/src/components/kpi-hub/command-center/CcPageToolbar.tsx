'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PM_CLIENT_OPTIONS } from '@/lib/performance-clients';

type Chip = { label: string; onRemove?: () => void };

type Props = {
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  chips?: Chip[];
  extraActions?: ReactNode;
  client?: string;
  onClientChange?: (client: string) => void;
  showClientFilter?: boolean;
};

export function CcPageToolbar({
  compare,
  onCompareChange,
  chips = [],
  extraActions,
  client = 'all',
  onClientChange,
  showClientFilter = false,
}: Props) {
  return (
    <div className="cc-toolbar">
      <div className="cc-toolbar__filters">
        {showClientFilter && onClientChange ? (
          <label className="cc-toolbar__compare">
            <span className="kpi-hub-muted" style={{ marginRight: 6 }}>
              Client
            </span>
            <select
              aria-label="Lọc theo Client"
              className="kpi-hub-date-chip"
              value={client}
              onChange={(e) => onClientChange(e.target.value)}
            >
              <option value="all">Tất cả</option>
              {PM_CLIENT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <input type="date" className="kpi-hub-date-chip" aria-label="Từ ngày" />
        <input type="date" className="kpi-hub-date-chip" aria-label="Đến ngày" />
        <label className="cc-toolbar__compare">
          <input type="checkbox" checked={compare} onChange={(e) => onCompareChange(e.target.checked)} />
          So với tháng trước
        </label>
        <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
          Xuất báo cáo
        </button>
        <Link href="/crm/kpi-hub/reports/new" className="kpi-hub-btn kpi-hub-btn--primary">
          + Tạo báo cáo
        </Link>
        {extraActions}
      </div>
      {chips.length > 0 ? (
        <div className="cc-toolbar__chips">
          {chips.map((chip) => (
            <span key={chip.label} className="cc-chip">
              {chip.label}
              {chip.onRemove ? (
                <button type="button" onClick={chip.onRemove} aria-label={`Xóa ${chip.label}`}>
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

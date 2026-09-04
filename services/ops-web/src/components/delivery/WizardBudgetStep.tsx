'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeliveryMilestoneInput } from '@/lib/delivery-projects-api';
import {
  DEFAULT_MIN_GROSS_MARGIN_PCT,
  computeGrossMarginPct,
  financeApprovalRequired,
  internalCostFromItems,
} from '@/lib/delivery-budget.util';
import { BudgetItemModal } from './BudgetItemModal';

export type BudgetItemRow = {
  id: string;
  name: string;
  kind: string;
  media_borne?: string | null;
  service_code?: string | null;
  approved_budget: string;
  forecast: string;
  actual: string;
};

export type ResourceRow = {
  id: string;
  staff_id: number;
  role_name?: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string;
};

type WizardBudgetStepProps = {
  projectId: string;
  projectCode?: string | null;
  projectName: string;
  serviceCodes: string[];
  milestones: DeliveryMilestoneInput[];
  contractBudget: string;
  contingency: string;
  items: BudgetItemRow[];
  resources: ResourceRow[];
  minMargin?: number;
  busy?: boolean;
  error?: string;
  canEdit?: boolean;
  token: string;
  onChangeContract: (v: string) => void;
  onChangeContingency: (v: string) => void;
  onItemsChange: (items: BudgetItemRow[]) => void;
  onResourcesChange: (resources: ResourceRow[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

function formatVnd(raw: string | null | undefined): string {
  if (!raw) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function WizardBudgetStep({
  projectId,
  projectCode,
  projectName,
  serviceCodes,
  milestones,
  contractBudget,
  contingency,
  items,
  resources,
  minMargin = DEFAULT_MIN_GROSS_MARGIN_PCT,
  busy,
  error,
  canEdit = true,
  token,
  onChangeContract,
  onChangeContingency,
  onItemsChange,
  onResourcesChange,
  onBack,
  onContinue,
}: WizardBudgetStepProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [requireFinanceToggle, setRequireFinanceToggle] = useState(true);

  const internalForecast = useMemo(
    () =>
      internalCostFromItems(
        items.map((i) => ({
          amount: i.forecast,
          kind: i.kind,
          media_borne: i.media_borne as 'agency_borne' | 'client_borne' | undefined,
        })),
      ),
    [items],
  );

  const clientMedia = useMemo(() => {
    let cents = 0;
    for (const i of items) {
      if (i.kind === 'media' && i.media_borne === 'client_borne') {
        cents += Number(i.forecast);
      }
    }
    return String(cents);
  }, [items]);

  const marginPct = useMemo(() => {
    if (!contractBudget) return null;
    return computeGrossMarginPct({
      contract: contractBudget,
      internalForecast,
      contingency: contingency || '0',
    });
  }, [contractBudget, internalForecast, contingency]);

  const approval = useMemo(
    () =>
      financeApprovalRequired({
        marginPct,
        minMargin,
        forecast: internalForecast,
        budget: contractBudget || '0',
      }),
    [marginPct, minMargin, internalForecast, contractBudget],
  );

  const handleItemSaved = useCallback(
    (item: BudgetItemRow) => {
      onItemsChange([...items, item]);
      setModalOpen(false);
    },
    [items, onItemsChange],
  );

  const handleResourceAdd = useCallback(() => {
    onResourcesChange([
      ...resources,
      {
        id: `draft-${Date.now()}`,
        staff_id: 0,
        role_name: 'Thành viên',
        allocation_pct: '50',
        start_date: milestones[0]?.start_date ?? '',
        end_date: milestones[milestones.length - 1]?.due_date ?? '',
      },
    ]);
  }, [milestones, onResourcesChange, resources]);

  const marginClass =
    marginPct != null && Number(marginPct) >= minMargin ? 'delivery-budget-tile--ok' : 'delivery-budget-tile--warn';

  return (
    <div className="delivery-wizard-split">
      <div className="delivery-wizard-main">
        <div className="delivery-wizard-panel">
          <div className="delivery-budget-toolbar">
            <span className="delivery-budget-method">Theo hạng mục dịch vụ</span>
            <span className="delivery-budget-currency">VND</span>
            <label className="delivery-budget-toggle">
              <input
                type="checkbox"
                checked={requireFinanceToggle}
                onChange={(e) => setRequireFinanceToggle(e.target.checked)}
              />
              Finance duyệt khi vượt ngưỡng
            </label>
          </div>

          <div className="delivery-budget-tiles" data-testid="budget-header-tiles">
            <div className="delivery-budget-tile">
              <span>Hợp đồng</span>
              <input
                className="delivery-filter-input"
                value={contractBudget}
                onChange={(e) => onChangeContract(e.target.value)}
                placeholder="—"
                disabled={!canEdit || busy}
              />
            </div>
            <div className="delivery-budget-tile">
              <span>Nội bộ</span>
              <strong>{formatVnd(internalForecast)}</strong>
            </div>
            <div className="delivery-budget-tile">
              <span>Media khách</span>
              <strong>{formatVnd(clientMedia)}</strong>
              <small className="delivery-budget-hint">không tính revenue</small>
            </div>
            <div className={`delivery-budget-tile ${marginClass}`}>
              <span>Biên gộp</span>
              <strong>{marginPct != null ? `${marginPct}%` : '—'}</strong>
            </div>
          </div>

          <div data-testid="budget-items-table">
            <div className="delivery-panel__head">
              <h3 className="delivery-panel__title">Hạng mục ngân sách</h3>
              {canEdit ? (
                <button type="button" className="delivery-btn delivery-btn--secondary" onClick={() => setModalOpen(true)}>
                  + Thêm hạng mục
                </button>
              ) : null}
            </div>
            <div className="delivery-table-wrap">
              <table className="delivery-table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Loại</th>
                    <th>Dự toán</th>
                    <th>Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="delivery-empty-hint">
                        Chưa có hạng mục
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.kind}</td>
                        <td>{formatVnd(row.approved_budget)}</td>
                        <td>{formatVnd(row.forecast)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div data-testid="budget-resources" style={{ marginTop: '1rem' }}>
            <div className="delivery-panel__head">
              <h3 className="delivery-panel__title">Nguồn lực</h3>
              {canEdit ? (
                <button type="button" className="delivery-btn delivery-btn--ghost" onClick={handleResourceAdd}>
                  Gán thành viên
                </button>
              ) : null}
            </div>
            {resources.length === 0 ? (
              <p className="delivery-empty-hint">Chưa gán nguồn lực</p>
            ) : (
              <ul className="delivery-budget-resource-list">
                {resources.map((r) => (
                  <li key={r.id}>
                    NV #{r.staff_id || '—'} · {r.allocation_pct}% · {r.start_date || '—'} → {r.end_date || '—'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="delivery-budget-contingency">
            <label>
              Contingency
              <input
                className="delivery-filter-input"
                value={contingency}
                onChange={(e) => onChangeContingency(e.target.value)}
                disabled={!canEdit || busy}
              />
            </label>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="delivery-wizard-footer">
            <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onBack} disabled={busy}>
              Quay lại: Kế hoạch &amp; Milestone
            </button>
            <button type="button" className="delivery-btn delivery-btn--primary" onClick={onContinue} disabled={busy}>
              Tiếp tục: KPI &amp; Xác nhận
            </button>
          </div>
        </div>
      </div>

      <aside className="delivery-wizard-rail" data-testid="budget-rail">
        <h4>Margin</h4>
        <div className="delivery-budget-donut">{marginPct != null ? `${marginPct}%` : '—'}</div>
        {approval.marginCritical ? <p className="delivery-budget-alert">Biên &lt; {minMargin}% — Critical</p> : null}
        {approval.forecastWarn ? <p className="delivery-budget-alert">Forecast vượt ngân sách</p> : null}
        <p className="delivery-empty-hint">Luồng: PM → Director → Finance</p>
        <p className="delivery-empty-hint">Ngưỡng: margin tối thiểu {minMargin}%</p>
        <Link href="/crm/kpi-hub/settings" className="delivery-link">
          Xem chính sách tài chính
        </Link>
      </aside>

      {modalOpen ? (
        <BudgetItemModal
          token={token}
          projectId={projectId}
          projectCode={projectCode}
          projectName={projectName}
          serviceCodes={serviceCodes}
          onClose={() => setModalOpen(false)}
          onSaved={handleItemSaved}
        />
      ) : null}
    </div>
  );
}

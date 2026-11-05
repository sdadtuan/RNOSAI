'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchKpiHubDictionary } from '@/lib/kpi-hub-api';
import { normalizeDictionaryList } from '@/lib/kpi-hub-normalize';
import {
  filterDictionaryRows,
  isDeprecatedDisabled,
  writeWizardKpiSelection,
  type DictionaryPickerRow,
} from '@/lib/delivery-kpi-picker.util';

const KPI_GROUPS = [
  'Acquisition',
  'Media Efficiency',
  'Funnel',
  'Sales Outcome',
  'Revenue',
  'Delivery',
  'Finance',
] as const;

const METRIC_TYPES = ['Count', 'Currency', '%', 'Duration'] as const;

const SOURCE_OPTIONS = ['CRM', 'Meta', 'Google', 'ERP', 'GA4', 'SharePoint'] as const;

type DictPickerOverlayProps = {
  open: boolean;
  projectId: string;
  projectLabel: string;
  token: string;
  onClose: () => void;
  onAttached: (count: number) => void;
};

export function DictPickerOverlay({
  open,
  projectId,
  projectLabel,
  token,
  onClose,
  onAttached,
}: DictPickerOverlayProps) {
  const [rows, setRows] = useState<DictionaryPickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [createDraftTargets, setCreateDraftTargets] = useState(true);
  const [inheritAlerts, setInheritAlerts] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    groups: [] as string[],
    status: 'ACTIVE',
    source: '',
    metric_type: '',
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchKpiHubDictionary(token, { status: 'ACTIVE', page_size: '100' })
      .then((res) => {
        const normalized = normalizeDictionaryList(res as Record<string, unknown>);
        setRows(
          normalized.data.map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            status: row.status,
            kpi_group: row.groupLabel ?? row.group ?? '',
            department: undefined,
            metric_type: row.unit,
            source: row.source,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  const filtered = useMemo(
    () =>
      filterDictionaryRows(rows, {
        q: filters.q,
        groups: filters.groups,
        status: filters.status,
        source: filters.source,
      }).filter((r) => !filters.metric_type || (r.metric_type ?? '').includes(filters.metric_type)),
    [rows, filters],
  );

  const focused = filtered.find((r) => r.id === focusedId) ?? filtered[0] ?? null;

  const toggle = useCallback((id: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function onConfirm() {
    const ids = [...selected];
    writeWizardKpiSelection(projectId, ids);
    onAttached(ids.length);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="delivery-dict-overlay" role="dialog" aria-modal="true">
      <div className="delivery-dict-overlay__backdrop" onClick={onClose} />
      <div className="delivery-dict-overlay__panel">
        <header className="delivery-dict-overlay__head">
          <div>
            <h2>Thêm KPI từ Dictionary</h2>
            <p>{projectLabel}</p>
          </div>
          <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onClose}>
            Đóng
          </button>
        </header>

        <div className="delivery-dict-layout">
          <aside className="delivery-dict-filters" data-testid="dict-picker-filter">
            <label>
              Tìm kiếm
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Mã hoặc tên KPI"
              />
            </label>
            <fieldset>
              <legend>Nhóm KPI</legend>
              {KPI_GROUPS.map((g) => (
                <label key={g} className="delivery-kpi-check">
                  <input
                    type="checkbox"
                    checked={filters.groups.includes(g)}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        groups: e.target.checked
                          ? [...f.groups, g]
                          : f.groups.filter((x) => x !== g),
                      }))
                    }
                  />
                  {g}
                </label>
              ))}
            </fieldset>
            <label>
              Trạng thái
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="DEPRECATED">Deprecated</option>
              </select>
            </label>
            <label>
              Nguồn
              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
              >
                <option value="">Tất cả</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metric type
              <select
                value={filters.metric_type}
                onChange={(e) => setFilters((f) => ({ ...f, metric_type: e.target.value }))}
              >
                <option value="">Tất cả</option>
                {METRIC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </aside>

          <div className="delivery-dict-table-wrap" data-testid="dict-picker-table">
            {loading ? <p className="delivery-empty-hint">Đang tải Dictionary…</p> : null}
            <table className="delivery-table">
              <thead>
                <tr>
                  <th />
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Nhóm</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const disabled = isDeprecatedDisabled(row.status);
                  return (
                    <tr
                      key={row.id}
                      className={focused?.id === row.id ? 'is-focused' : ''}
                      onClick={() => setFocusedId(row.id)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          disabled={disabled}
                          title={disabled ? 'Không thể chọn KPI đã Deprecated' : undefined}
                          onChange={() => toggle(row.id, disabled)}
                        />
                      </td>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.kpi_group}</td>
                      <td>{row.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="delivery-dict-rail" data-testid="dict-picker-rail">
            <h4>Inspector</h4>
            {focused ? (
              <>
                <p>
                  <strong>{focused.code}</strong> — {focused.name}
                </p>
                <p>Nhóm: {focused.kpi_group}</p>
                <p>Nguồn: {focused.source ?? '—'}</p>
                <label className="delivery-kpi-check">
                  <input type="radio" checked readOnly />
                  Kế thừa version Active
                </label>
                <label className="delivery-kpi-check">
                  <input
                    type="checkbox"
                    checked={createDraftTargets}
                    onChange={(e) => setCreateDraftTargets(e.target.checked)}
                  />
                  Tạo target draft (PROJECT scope)
                </label>
                <label className="delivery-kpi-check">
                  <input
                    type="checkbox"
                    checked={inheritAlerts}
                    onChange={(e) => setInheritAlerts(e.target.checked)}
                  />
                  Kế thừa cảnh báo Hub
                </label>
                {focused.status === 'PENDING_APPROVAL' ? (
                  <p className="delivery-kpi-warn-text">Pending — có thể chọn nhưng cần cân nhắc.</p>
                ) : null}
              </>
            ) : (
              <p className="delivery-empty-hint">Chọn một KPI để xem chi tiết.</p>
            )}
          </aside>
        </div>

        <footer className="delivery-dict-overlay__foot">
          <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="delivery-btn delivery-btn--primary"
            disabled={selected.size === 0}
            onClick={onConfirm}
          >
            Thêm {selected.size} KPI vào dự án
          </button>
        </footer>
      </div>
    </div>
  );
}

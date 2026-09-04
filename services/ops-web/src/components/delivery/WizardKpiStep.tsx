'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  attachDeliveryProjectKpis,
  fetchDeliveryProjectKpis,
  submitDeliveryProject,
  type DeliveryProjectKpiRow,
  type DeliveryProjectRow,
} from '@/lib/delivery-projects-api';
import { readWizardKpiSelection } from '@/lib/delivery-kpi-picker.util';

type WizardKpiStepProps = {
  project: DeliveryProjectRow;
  token: string;
  busy?: boolean;
  error?: string;
  onBusyChange?: (busy: boolean) => void;
  onError?: (msg: string) => void;
  onOpenPicker: () => void;
  onBack: () => void;
  onSubmitted: () => void;
};

type ChecklistState = {
  scope_confirmed: boolean;
  budget_confirmed: boolean;
  kpi_confirmed: boolean;
};

export function WizardKpiStep({
  project,
  token,
  busy,
  error,
  onBusyChange,
  onError,
  onOpenPicker,
  onBack,
  onSubmitted,
}: WizardKpiStepProps) {
  const [kpis, setKpis] = useState<DeliveryProjectKpiRow[]>([]);
  const [skipReason, setSkipReason] = useState('');
  const [checklist, setChecklist] = useState<ChecklistState>({
    scope_confirmed: false,
    budget_confirmed: false,
    kpi_confirmed: false,
  });
  const [toast, setToast] = useState('');

  const reload = useCallback(async () => {
    const res = await fetchDeliveryProjectKpis(token, project.id);
    setKpis(res.items);
  }, [project.id, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const pending = readWizardKpiSelection(project.id);
    if (!pending.length) return;
    onBusyChange?.(true);
    void attachDeliveryProjectKpis(token, project.id, {
      dictionary_ids: pending,
      create_draft_targets: true,
      inherit_alerts: true,
    })
      .then(() => reload())
      .catch((err) => onError?.(err instanceof Error ? err.message : 'Gắn KPI thất bại'))
      .finally(() => onBusyChange?.(false));
  }, [project.id, token, reload, onBusyChange, onError]);

  const healthPreview = useMemo(() => {
    const total = Math.max(kpis.length, 1);
    const withTarget = kpis.filter((k) => k.target_id).length;
    return Math.round((withTarget / total) * 100);
  }, [kpis]);

  async function onSubmit() {
    if (kpis.length === 0 && !skipReason.trim()) {
      onError?.('Chọn ít nhất một KPI hoặc nhập lý do bỏ qua');
      return;
    }
    if (!checklist.scope_confirmed || !checklist.budget_confirmed || !checklist.kpi_confirmed) {
      onError?.('Hoàn thành checklist xác nhận');
      return;
    }
    onBusyChange?.(true);
    onError?.('');
    try {
      await submitDeliveryProject(token, project.id, {
        skip_kpi_reason: skipReason.trim() || undefined,
        checklist,
        cadence_json: { weekly_review: true, client_report: true },
      });
      onSubmitted();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gửi phê duyệt thất bại');
    } finally {
      onBusyChange?.(false);
    }
  }

  return (
    <div className="delivery-wizard-panel delivery-kpi-step">
      {toast ? <div className="delivery-toast">{toast}</div> : null}
      <div className="delivery-kpi-toolbar">
        <button type="button" className="delivery-btn delivery-btn--primary" onClick={onOpenPicker}>
          + Thêm KPI từ Dictionary
        </button>
        <button
          type="button"
          className="delivery-btn delivery-btn--ghost"
          onClick={() => {
            setToast('Chưa có template');
            setTimeout(() => setToast(''), 3000);
          }}
        >
          Sao chép từ Template
        </button>
      </div>

      <div className="delivery-kpi-layout">
        <div className="delivery-kpi-main">
          <div className="delivery-table-wrap" data-testid="wiz-kpi-table">
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>Mã KPI</th>
                  <th>Tên</th>
                  <th>Chu kỳ</th>
                  <th>Target draft</th>
                  <th>Kế thừa cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {kpis.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="delivery-empty-hint">
                      Chưa gắn KPI — thêm từ Dictionary hoặc nhập lý do bỏ qua bên dưới.
                    </td>
                  </tr>
                ) : (
                  kpis.map((k) => (
                    <tr key={k.id}>
                      <td>{k.dictionary_code}</td>
                      <td>{k.dictionary_name}</td>
                      <td>{k.cycle === 'WEEK' ? 'Tuần' : 'Tháng'}</td>
                      <td>{k.target_id ? 'Có' : '—'}</td>
                      <td>{k.inherit_alert ? 'Có' : 'Không'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="delivery-kpi-warn-grid">
            <label className="delivery-kpi-warn">
              <span>Cảnh báo 2 cột (warning / critical)</span>
              <input type="text" placeholder="Kế thừa từ Dictionary" disabled />
            </label>
            <label className="delivery-kpi-warn">
              <span>Cadence báo cáo</span>
              <select defaultValue="monthly">
                <option value="weekly">Tuần</option>
                <option value="monthly">Tháng</option>
              </select>
            </label>
          </div>

          <fieldset className="delivery-kpi-checklist">
            <legend>Checklist bắt buộc</legend>
            {(
              [
                ['scope_confirmed', 'Phạm vi & milestone đã xác nhận'],
                ['budget_confirmed', 'Ngân sách & nguồn lực đã xác nhận'],
                ['kpi_confirmed', 'KPI dự án đã xác nhận hoặc có lý do bỏ qua'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="delivery-kpi-check">
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={(e) => setChecklist((s) => ({ ...s, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {kpis.length === 0 ? (
            <label className="delivery-kpi-skip">
              <span>Lý do bỏ qua KPI</span>
              <input
                type="text"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="VD: Dự án ingest-only, chưa cần KPI delivery"
              />
            </label>
          ) : null}

          {error ? <p className="delivery-form-error">{error}</p> : null}
        </div>

        <aside className="delivery-kpi-rail" data-testid="wiz-kpi-rail">
          <h4>Tóm tắt</h4>
          <p>{project.code ?? '—'} · {project.name}</p>
          <p>{kpis.length} KPI đã gắn</p>
          <h4>KPI Health Preview</h4>
          <div className="delivery-kpi-health-bar">
            <div className="delivery-kpi-health-bar__fill" style={{ width: `${healthPreview}%` }} />
          </div>
          <p className="delivery-empty-hint">Preview từ target draft — không ghi fact production.</p>
          <h4>Luồng duyệt</h4>
          <ol className="delivery-kpi-flow">
            <li>PM</li>
            <li>Delivery Director</li>
            <li>Finance (nếu cần)</li>
          </ol>
          <h4>Pre-check</h4>
          <ul className="delivery-kpi-precheck">
            <li>Dictionary Active</li>
            <li>Không Deprecated</li>
            <li>Target PROJECT scope</li>
          </ul>
        </aside>
      </div>

      <div className="delivery-wizard-footer">
        <button type="button" className="delivery-btn delivery-btn--ghost" disabled={busy} onClick={onBack}>
          Quay lại: Ngân sách & Nguồn lực
        </button>
        <button
          type="button"
          className="delivery-btn delivery-btn--primary"
          data-testid="wiz-submit"
          disabled={busy}
          onClick={() => void onSubmit()}
        >
          Tạo dự án & Gửi phê duyệt
        </button>
      </div>
    </div>
  );
}

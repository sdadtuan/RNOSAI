'use client';

import { useMemo } from 'react';
import { FormField, FormInput } from '@/components/form';
import type { DeliveryMilestoneInput } from '@/lib/delivery-projects-api';
import { hasCircularMilestoneDeps } from '@/lib/delivery-projects.util';
import { DeliveryGantt } from './DeliveryGantt';
import type { DeliveryProjectRow } from '@/lib/delivery-projects-api';

type WizardStep3MilestoneProps = {
  startDate: string;
  endDate: string;
  milestones: DeliveryMilestoneInput[];
  depsText: Record<string, string>;
  busy?: boolean;
  error?: string;
  depError?: string;
  onChange: (patch: {
    startDate?: string;
    endDate?: string;
    milestones?: DeliveryMilestoneInput[];
    depsText?: Record<string, string>;
  }) => void;
  onBack: () => void;
  onContinue: () => void;
};

function nextMilestoneCode(existing: DeliveryMilestoneInput[]): string {
  let max = 0;
  for (const m of existing) {
    const match = /^M(\d+)$/i.exec(m.code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `M${max + 1}`;
}

export function WizardStep3Milestone({
  startDate,
  endDate,
  milestones,
  depsText,
  busy,
  error,
  depError,
  onChange,
  onBack,
  onContinue,
}: WizardStep3MilestoneProps) {
  const edges = useMemo(() => {
    const out: Array<{ from: string; to: string }> = [];
    for (const m of milestones) {
      const raw = depsText[m.code] ?? '';
      for (const to of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
        out.push({ from: m.code, to });
      }
    }
    return out;
  }, [milestones, depsText]);

  const circular = hasCircularMilestoneDeps(edges);
  const ganttRows: DeliveryProjectRow[] = milestones.map((m, i) => ({
    id: `m-${i}`,
    tenant_id: 'PTT',
    code: m.code,
    name: m.name,
    capabilities: ['delivery'],
    b2b_project_id: null,
    status: 'draft',
    customer_id: null,
    project_type: '',
    priority: 'normal',
    pm_staff_id: null,
    am_staff_id: null,
    start_date: m.start_date ?? startDate ?? null,
    end_date: m.due_date ?? endDate ?? null,
    description: '',
    health_status: 'no_data',
    health_components_json: {},
    row_version: 1,
  }));

  function addMilestone() {
    const code = nextMilestoneCode(milestones);
    onChange({
      milestones: [
        ...milestones,
        { code, name: `Milestone ${code}`, status: 'planned', start_date: startDate || null, due_date: endDate || null },
      ],
      depsText: { ...depsText, [code]: '' },
    });
  }

  function updateMilestone(idx: number, patch: Partial<DeliveryMilestoneInput>) {
    onChange({ milestones: milestones.map((m, i) => (i === idx ? { ...m, ...patch } : m)) });
  }

  return (
    <div className="delivery-wizard-panel delivery-wizard-split">
      <div className="delivery-wizard-main">
        <h2 className="delivery-wizard-panel__title">Kế hoạch & Milestone</h2>
        {error ? <p className="error">{error}</p> : null}
        {depError ? <p className="error">{depError}</p> : null}

        <div className="delivery-form-grid">
          <FormField label="Ngày bắt đầu">
            <FormInput type="date" value={startDate} disabled={busy} onChange={(e) => onChange({ startDate: e.target.value })} />
          </FormField>
          <FormField label="Ngày kết thúc">
            <FormInput type="date" value={endDate} disabled={busy} onChange={(e) => onChange({ endDate: e.target.value })} />
          </FormField>
          <FormField label="Phương pháp">
            <FormInput value="Theo Milestone" disabled readOnly />
          </FormField>
          <FormField label="Lịch làm việc">
            <FormInput value="Thứ Hai – Thứ Sáu" disabled readOnly />
          </FormField>
        </div>

        <label className="delivery-toggle">
          <input type="checkbox" disabled checked={false} readOnly />
          <span>Tự động lên lịch (tắt Wave B)</span>
        </label>

        <div className="delivery-table-wrap">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Start</th>
                <th>Due</th>
                <th>Trạng thái</th>
                <th>Deps</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, idx) => (
                <tr key={m.code}>
                  <td>{m.code}</td>
                  <td>
                    <FormInput value={m.name} disabled={busy} onChange={(e) => updateMilestone(idx, { name: e.target.value })} />
                  </td>
                  <td>
                    <FormInput
                      type="date"
                      value={m.start_date ?? ''}
                      disabled={busy}
                      onChange={(e) => updateMilestone(idx, { start_date: e.target.value || null })}
                    />
                  </td>
                  <td>
                    <FormInput
                      type="date"
                      value={m.due_date ?? ''}
                      disabled={busy}
                      onChange={(e) => updateMilestone(idx, { due_date: e.target.value || null })}
                    />
                  </td>
                  <td>Planned</td>
                  <td>
                    <FormInput
                      value={depsText[m.code] ?? ''}
                      disabled={busy}
                      placeholder="M1,M2"
                      onChange={(e) => onChange({ depsText: { ...depsText, [m.code]: e.target.value } })}
                    />
                  </td>
                  <td>
                    <FormInput
                      type="number"
                      value={m.owner_staff_id ?? ''}
                      disabled={busy}
                      onChange={(e) =>
                        updateMilestone(idx, { owner_staff_id: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="delivery-btn delivery-btn--secondary" disabled={busy} onClick={addMilestone}>
          + Milestone
        </button>

        <div className="delivery-gantt-preview">
          <DeliveryGantt rows={ganttRows} />
        </div>

        <div className="delivery-wizard-footer">
          <button type="button" className="delivery-btn delivery-btn--ghost" disabled={busy} onClick={onBack}>
            Quay lại: Phạm vi
          </button>
          <button type="button" className="delivery-btn delivery-btn--primary" disabled={busy || circular} onClick={onContinue}>
            Tiếp tục: Ngân sách
          </button>
        </div>
      </div>

      <aside className="delivery-wizard-rail">
        <p>
          Số milestone: <strong>{milestones.length}</strong>
        </p>
        <p className="delivery-hint">Path: {milestones.map((m) => m.code).join(' → ') || '—'}</p>
        {circular ? (
          <span className="delivery-badge delivery-badge--warn">Phụ thuộc vòng</span>
        ) : milestones.length ? (
          <span className="delivery-badge delivery-badge--ok">Khả thi</span>
        ) : null}
      </aside>
    </div>
  );
}

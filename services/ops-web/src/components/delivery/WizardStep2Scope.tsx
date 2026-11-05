'use client';

import { useMemo } from 'react';
import { FormField, FormInput, FormTextarea } from '@/components/form';
import { DELIVERY_SERVICE_CATALOG } from '@/lib/delivery-projects-api';
import type { DeliveryDeliverableInput } from '@/lib/delivery-projects-api';
import { DELIVERY_CONFLICT_LABELS, detectScopeConflicts } from '@/lib/delivery-conflicts';

type WizardStep2ScopeProps = {
  selectedServices: string[];
  deliverables: DeliveryDeliverableInput[];
  outOfScope: string;
  assumptions: string;
  dismissedConflicts: string[];
  busy?: boolean;
  error?: string;
  onChange: (patch: {
    selectedServices?: string[];
    deliverables?: DeliveryDeliverableInput[];
    outOfScope?: string;
    assumptions?: string;
    dismissedConflicts?: string[];
  }) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function WizardStep2Scope({
  selectedServices,
  deliverables,
  outOfScope,
  assumptions,
  dismissedConflicts,
  busy,
  error,
  onChange,
  onBack,
  onContinue,
}: WizardStep2ScopeProps) {
  const conflicts = useMemo(() => detectScopeConflicts(selectedServices), [selectedServices]);
  const activeConflicts = conflicts.filter((c) => !dismissedConflicts.includes(c));

  function toggleService(code: string) {
    const set = new Set(selectedServices);
    if (set.has(code)) {
      set.delete(code);
      onChange({
        selectedServices: [...set],
        deliverables: deliverables.filter((d) => d.service_code !== code),
      });
    } else {
      set.add(code);
      const catalog = DELIVERY_SERVICE_CATALOG.find((s) => s.code === code);
      onChange({
        selectedServices: [...set],
        deliverables: [
          ...deliverables,
          {
            service_code: code,
            name: catalog ? `Hạng mục ${catalog.name}` : `Hạng mục ${code}`,
            quantity: '1',
            acceptance: '',
          },
        ],
      });
    }
  }

  function updateDeliverable(idx: number, patch: Partial<DeliveryDeliverableInput>) {
    const next = deliverables.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange({ deliverables: next });
  }

  function removeDeliverable(idx: number) {
    onChange({ deliverables: deliverables.filter((_, i) => i !== idx) });
  }

  return (
    <div className="delivery-wizard-panel delivery-wizard-split">
      <div className="delivery-wizard-main">
        <h2 className="delivery-wizard-panel__title">Phạm vi & Dịch vụ</h2>
        {error ? <p className="error">{error}</p> : null}

        <div className="delivery-service-cards">
          {DELIVERY_SERVICE_CATALOG.map((svc) => (
            <button
              key={svc.code}
              type="button"
              className={`delivery-service-card${selectedServices.includes(svc.code) ? ' is-selected' : ''}`}
              disabled={busy}
              onClick={() => toggleService(svc.code)}
            >
              <strong>{svc.name}</strong>
              <span>{svc.code}</span>
            </button>
          ))}
        </div>

        <div className="delivery-table-wrap">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Hạng mục</th>
                <th>SL</th>
                <th>Nghiệm thu</th>
                <th>PIC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d, idx) => (
                <tr key={`${d.service_code}-${idx}`}>
                  <td>{d.service_code}</td>
                  <td>
                    <FormInput
                      value={d.name}
                      disabled={busy}
                      onChange={(e) => updateDeliverable(idx, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <FormInput
                      value={d.quantity ?? ''}
                      disabled={busy}
                      onChange={(e) => updateDeliverable(idx, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <FormInput
                      value={d.acceptance ?? ''}
                      disabled={busy}
                      onChange={(e) => updateDeliverable(idx, { acceptance: e.target.value })}
                    />
                  </td>
                  <td>
                    <FormInput
                      type="number"
                      value={d.owner_staff_id ?? ''}
                      disabled={busy}
                      onChange={(e) =>
                        updateDeliverable(idx, {
                          owner_staff_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="delivery-btn delivery-btn--ghost" disabled={busy} onClick={() => removeDeliverable(idx)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <FormField label="Ngoài phạm vi">
          <FormTextarea value={outOfScope} disabled={busy} onChange={(e) => onChange({ outOfScope: e.target.value })} rows={2} />
        </FormField>
        <FormField label="Giả định">
          <FormTextarea value={assumptions} disabled={busy} onChange={(e) => onChange({ assumptions: e.target.value })} rows={2} />
        </FormField>

        <div className="delivery-wizard-footer">
          <button type="button" className="delivery-btn delivery-btn--ghost" disabled={busy} onClick={onBack}>
            Quay lại: Thông tin cơ bản
          </button>
          <button type="button" className="delivery-btn delivery-btn--primary" disabled={busy} onClick={onContinue}>
            Tiếp tục: Kế hoạch & Milestone
          </button>
        </div>
      </div>

      <aside className="delivery-wizard-rail">
        <p>
          <strong>{selectedServices.length}</strong> dịch vụ
        </p>
        {activeConflicts.length ? (
          <ul className="delivery-conflict-list">
            {activeConflicts.map((c) => (
              <li key={c}>
                {DELIVERY_CONFLICT_LABELS[c] ?? c}
                <label className="delivery-conflict-dismiss">
                  <input
                    type="checkbox"
                    checked={dismissedConflicts.includes(c)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...dismissedConflicts, c]
                        : dismissedConflicts.filter((x) => x !== c);
                      onChange({ dismissedConflicts: next });
                    }}
                  />
                  Đã xử lý
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="delivery-hint">Không có cảnh báo phạm vi.</p>
        )}
      </aside>
    </div>
  );
}

'use client';

import { FormCheck, FormField, FormInput, FormSelect, FormTextarea } from '@/components/form';
import { DELIVERY_SERVICE_CATALOG } from '@/lib/delivery-projects-api';
import type { DeliveryCapability } from '@/lib/delivery-projects.util';
import { normalizeProjectCode } from '@/lib/b2b-project-util';
import { wizardFooter } from '@/lib/delivery-wizard.util';

export type WizardStep1Values = {
  name: string;
  capabilities: DeliveryCapability[];
  ingest_code: string;
  customer_id: string;
  project_type: string;
  priority: string;
  pm_staff_id: string;
  am_staff_id: string;
  start_date: string;
  end_date: string;
  description: string;
  ai_call_enabled: boolean;
  manual_ingest_enabled: boolean;
  service_codes: string[];
};

type WizardStep1BasicProps = {
  values: WizardStep1Values;
  onChange: (values: WizardStep1Values) => void;
  canManageB2b: boolean;
  canEditDelivery: boolean;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onSaveDraft: () => void;
  onPrimary: () => void;
};

export function WizardStep1Basic({
  values,
  onChange,
  canManageB2b,
  canEditDelivery,
  busy,
  error,
  onCancel,
  onSaveDraft,
  onPrimary,
}: WizardStep1BasicProps) {
  const footer = wizardFooter(values.capabilities);
  const hasLead = values.capabilities.includes('lead_ingest');
  const hasDelivery = values.capabilities.includes('delivery');

  function toggleCap(cap: DeliveryCapability) {
    const caps = new Set(values.capabilities);
    if (caps.has(cap)) caps.delete(cap);
    else caps.add(cap);
    onChange({ ...values, capabilities: [...caps] as DeliveryCapability[] });
  }

  return (
    <div className="delivery-wizard-panel">
      <h2 className="delivery-wizard-panel__title">Thông tin cơ bản</h2>
      {error ? <p className="error">{error}</p> : null}

      <div className="delivery-toggle-row">
        <label className="delivery-toggle">
          <input
            type="checkbox"
            checked={hasLead}
            disabled={!canManageB2b || busy}
            onChange={() => toggleCap('lead_ingest')}
          />
          <span>Nhận lead PTT</span>
        </label>
        <label className="delivery-toggle">
          <input
            type="checkbox"
            checked={hasDelivery}
            disabled={!canEditDelivery || busy}
            onChange={() => toggleCap('delivery')}
          />
          <span>Giao hàng</span>
        </label>
      </div>

      <div className="delivery-form-grid">
        <FormField label="Tên dự án">
          <FormInput
            value={values.name}
            disabled={busy}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            required
          />
        </FormField>

        {hasLead ? (
          <FormField label="Slug (webhook)" hint="Dùng trong URL webhook Meta/Zalo">
            <FormInput
              value={values.ingest_code}
              disabled={busy}
              onChange={(e) => onChange({ ...values, ingest_code: normalizeProjectCode(e.target.value) })}
              placeholder="vd: an-gia"
            />
          </FormField>
        ) : null}

        {hasDelivery ? (
          <FormField label="Mã PRJ">
            <FormInput value="Tự cấp khi lưu" disabled readOnly />
          </FormField>
        ) : null}

        {hasDelivery ? (
          <FormField label="ID khách (tùy chọn)">
            <FormInput
              type="number"
              value={values.customer_id}
              disabled={busy}
              onChange={(e) => onChange({ ...values, customer_id: e.target.value })}
            />
          </FormField>
        ) : null}

        <FormField label="Loại dự án">
          <FormInput
            value={values.project_type}
            disabled={busy}
            onChange={(e) => onChange({ ...values, project_type: e.target.value })}
          />
        </FormField>

        <FormField label="Ưu tiên">
          <FormSelect
            value={values.priority}
            disabled={busy}
            onChange={(e) => onChange({ ...values, priority: e.target.value })}
          >
            <option value="normal">Bình thường</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn</option>
          </FormSelect>
        </FormField>

        {hasDelivery ? (
          <FormField label="PM (staff_id)" hint="Bắt buộc khi bật Giao hàng">
            <FormInput
              type="number"
              value={values.pm_staff_id}
              disabled={busy}
              onChange={(e) => onChange({ ...values, pm_staff_id: e.target.value })}
            />
          </FormField>
        ) : null}

        <FormField label="AM (staff_id)">
          <FormInput
            type="number"
            value={values.am_staff_id}
            disabled={busy}
            onChange={(e) => onChange({ ...values, am_staff_id: e.target.value })}
          />
        </FormField>

        <FormField label="Ngày bắt đầu">
          <FormInput
            type="date"
            value={values.start_date}
            disabled={busy}
            onChange={(e) => onChange({ ...values, start_date: e.target.value })}
          />
        </FormField>

        <FormField label="Ngày kết thúc">
          <FormInput
            type="date"
            value={values.end_date}
            disabled={busy}
            onChange={(e) => onChange({ ...values, end_date: e.target.value })}
          />
        </FormField>
      </div>

      <FormField label="Dịch vụ (catalog)">
        <div className="delivery-service-chips">
          {DELIVERY_SERVICE_CATALOG.map((svc) => (
            <label key={svc.code} className="delivery-service-chip">
              <input
                type="checkbox"
                checked={values.service_codes.includes(svc.code)}
                disabled={busy}
                onChange={(e) => {
                  const codes = new Set(values.service_codes);
                  if (e.target.checked) codes.add(svc.code);
                  else codes.delete(svc.code);
                  onChange({ ...values, service_codes: [...codes] });
                }}
              />
              {svc.name}
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="Mô tả">
        <FormTextarea
          value={values.description}
          disabled={busy}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          rows={3}
        />
      </FormField>

      {hasLead ? (
        <fieldset className="delivery-fieldset">
          <legend>Nhận lead</legend>
          <FormCheck label="Bật AI call">
            <input
              type="checkbox"
              checked={values.ai_call_enabled}
              disabled={busy}
              onChange={(e) => onChange({ ...values, ai_call_enabled: e.target.checked })}
            />
          </FormCheck>
          <FormCheck label="Nhập lead thủ công">
            <input
              type="checkbox"
              checked={values.manual_ingest_enabled}
              disabled={busy}
              onChange={(e) => onChange({ ...values, manual_ingest_enabled: e.target.checked })}
            />
          </FormCheck>
          <p className="delivery-hint">
            Cấu hình kênh Page/OA sau khi lưu — xem tab Nhận lead trên trang chi tiết.
          </p>
        </fieldset>
      ) : null}

      <div className="delivery-wizard-footer">
        <button type="button" className="delivery-btn delivery-btn--ghost" disabled={busy} onClick={onCancel}>
          Hủy
        </button>
        <button type="button" className="delivery-btn delivery-btn--secondary" disabled={busy} onClick={onSaveDraft}>
          Lưu nháp
        </button>
        <button type="button" className="delivery-btn delivery-btn--primary" disabled={busy} onClick={onPrimary}>
          {footer.primary === 'continue_scope' ? 'Tiếp tục: Phạm vi & Dịch vụ' : 'Lưu dự án'}
        </button>
      </div>
    </div>
  );
}

export function defaultWizardStep1Values(opts: {
  defaultLead?: boolean;
  defaultDelivery?: boolean;
}): WizardStep1Values {
  return {
    name: '',
    capabilities: [
      ...(opts.defaultLead ? (['lead_ingest'] as const) : []),
      ...(opts.defaultDelivery ? (['delivery'] as const) : []),
    ],
    ingest_code: '',
    customer_id: '',
    project_type: '',
    priority: 'normal',
    pm_staff_id: '',
    am_staff_id: '',
    start_date: '',
    end_date: '',
    description: '',
    ai_call_enabled: false,
    manual_ingest_enabled: true,
    service_codes: [],
  };
}

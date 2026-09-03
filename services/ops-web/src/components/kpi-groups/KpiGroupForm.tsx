'use client';

import type { StaffDepartmentRow, StaffOrgPositionRow, StaffTeamRow } from '@/lib/api';
import { KpiGroupScopePicker } from '@/components/kpi-groups/KpiGroupScopePicker';
import type { KpiGroupFormFieldErrors, KpiGroupFormValues } from '@/lib/kpi-group-form.util';
import { normalizeKpiGroupCode } from '@/lib/kpi-group-form.util';
import {
  KPI_GROUP_DATA_DOMAIN_OPTIONS,
  KPI_GROUP_DIRECTION_LABELS,
  KPI_GROUP_ICON_OPTIONS,
  KPI_GROUP_UNIT_TYPE_OPTIONS,
  kpiGroupErrorMessage,
} from '@/lib/kpi-group-util';
import type { KpiGroupDirection } from '@/lib/kpi-group-util';

type KpiGroupFormProps = {
  values: KpiGroupFormValues;
  errors: KpiGroupFormFieldErrors;
  departments: StaffDepartmentRow[];
  positions: StaffOrgPositionRow[];
  teams: StaffTeamRow[];
  codeLocked?: boolean;
  disabled?: boolean;
  onChange: (next: KpiGroupFormValues) => void;
};

function fieldError(errors: KpiGroupFormFieldErrors, key: keyof KpiGroupFormValues): string | undefined {
  const code = errors[key];
  if (!code) return undefined;
  return kpiGroupErrorMessage(code) !== code ? kpiGroupErrorMessage(code) : String(code);
}

export function KpiGroupForm({
  values,
  errors,
  departments,
  positions,
  teams,
  codeLocked,
  disabled,
  onChange,
}: KpiGroupFormProps) {
  function patch(partial: Partial<KpiGroupFormValues>) {
    onChange({ ...values, ...partial });
  }

  function toggleUnitType(id: string) {
    const next = values.suggested_unit_types.includes(id)
      ? values.suggested_unit_types.filter((u) => u !== id)
      : [...values.suggested_unit_types, id];
    patch({ suggested_unit_types: next });
  }

  function toggleDataDomain(id: string) {
    const next = values.data_domains.includes(id)
      ? values.data_domains.filter((d) => d !== id)
      : [...values.data_domains, id];
    patch({ data_domains: next });
  }

  return (
    <div className="kpi-group-form-sections">
      <section className="kpi-group-form-section">
        <h2 className="kpi-group-form-section__title">1. Thông tin cơ bản</h2>
        <div className="kpi-group-form-grid">
          <label>
            Mã nhóm KPI <span className="required">*</span>
            <input
              className="kpi-input"
              value={values.code}
              disabled={disabled || codeLocked}
              onChange={(e) => patch({ code: normalizeKpiGroupCode(e.target.value) })}
              placeholder="GROWTH_CONVERSION"
            />
            {fieldError(errors, 'code') ? <span className="error">{fieldError(errors, 'code')}</span> : null}
          </label>
          <label>
            Tên nhóm KPI <span className="required">*</span>
            <input
              className="kpi-input"
              value={values.name}
              disabled={disabled}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Tăng trưởng & Chuyển đổi"
            />
            {fieldError(errors, 'name') ? <span className="error">{fieldError(errors, 'name')}</span> : null}
          </label>
          <label className="kpi-group-form-grid__full">
            Mô tả
            <textarea
              className="kpi-input"
              rows={3}
              maxLength={500}
              value={values.description}
              disabled={disabled}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Mô tả ngắn về mục tiêu quản trị của nhóm KPI"
            />
            <span className="kpi-group-char-counter">{values.description.length}/500</span>
            {fieldError(errors, 'description') ? (
              <span className="error">{fieldError(errors, 'description')}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="kpi-group-form-section">
        <h2 className="kpi-group-form-section__title">2. Phạm vi áp dụng</h2>
        <KpiGroupScopePicker
          scopeType={values.scope_type}
          departmentIds={values.department_ids}
          positionIds={values.position_ids}
          departments={departments}
          positions={positions}
          teams={teams}
          disabled={disabled}
          scopeError={fieldError(errors, 'scope_type')}
          onScopeTypeChange={(scope_type) => {
            const next: Partial<KpiGroupFormValues> = { scope_type };
            if (scope_type === 'ORGANIZATION') {
              next.department_ids = [];
              next.position_ids = [];
            }
            patch(next);
          }}
          onDepartmentIdsChange={(department_ids) => patch({ department_ids })}
          onPositionIdsChange={(position_ids) => patch({ position_ids })}
        />
      </section>

      <section className="kpi-group-form-section">
        <h2 className="kpi-group-form-section__title">3. Thiết lập đo lường mặc định</h2>
        <div className="kpi-group-form-grid">
          <label>
            Hướng đo mặc định <span className="required">*</span>
            <select
              className="kpi-select"
              value={values.default_direction}
              disabled={disabled}
              onChange={(e) => patch({ default_direction: e.target.value as KpiGroupDirection | '' })}
            >
              <option value="">— Chọn —</option>
              {(Object.keys(KPI_GROUP_DIRECTION_LABELS) as KpiGroupDirection[]).map((d) => (
                <option key={d} value={d}>
                  {KPI_GROUP_DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
            {fieldError(errors, 'default_direction') ? (
              <span className="error">{fieldError(errors, 'default_direction')}</span>
            ) : null}
          </label>
        </div>
        <div className="kpi-group-form-subblock">
          <p className="kpi-group-form__label">Loại đơn vị đề xuất</p>
          <div className="kpi-group-multi-select">
            {KPI_GROUP_UNIT_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`kpi-group-chip-select${values.suggested_unit_types.includes(opt.id) ? ' is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={values.suggested_unit_types.includes(opt.id)}
                  disabled={disabled}
                  onChange={() => toggleUnitType(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="kpi-group-form-subblock">
          <p className="kpi-group-form__label">Miền dữ liệu nguồn</p>
          <div className="kpi-group-domain-chips">
            {KPI_GROUP_DATA_DOMAIN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`kpi-group-domain-chip${values.data_domains.includes(opt.id) ? ' is-selected' : ''}`}
                disabled={disabled}
                onClick={() => toggleDataDomain(opt.id)}
              >
                <span aria-hidden>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="kpi-group-form-section">
        <h2 className="kpi-group-form-section__title">4. Nhận diện & hiển thị</h2>
        <div className="kpi-group-form-grid">
          <label>
            Màu nhận diện <span className="required">*</span>
            <div className="kpi-group-color-field">
              <input
                type="color"
                value={values.color}
                disabled={disabled}
                onChange={(e) => patch({ color: e.target.value.toUpperCase() })}
              />
              <input
                className="kpi-input"
                value={values.color}
                disabled={disabled}
                onChange={(e) => patch({ color: e.target.value.toUpperCase() })}
              />
            </div>
            {fieldError(errors, 'color') ? <span className="error">{fieldError(errors, 'color')}</span> : null}
          </label>
          <label>
            Biểu tượng
            <select
              className="kpi-select"
              value={values.icon}
              disabled={disabled}
              onChange={(e) => patch({ icon: e.target.value })}
            >
              {KPI_GROUP_ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thứ tự hiển thị <span className="required">*</span>
            <input
              className="kpi-input"
              type="number"
              min={1}
              value={values.display_order}
              disabled={disabled}
              onChange={(e) => {
                const raw = e.target.value;
                patch({ display_order: raw === '' ? '' : Number(raw) });
              }}
            />
            {fieldError(errors, 'display_order') ? (
              <span className="error">{fieldError(errors, 'display_order')}</span>
            ) : null}
          </label>
        </div>
        <div className="kpi-group-preview-bar kpi-group-preview-bar--inline" style={{ borderColor: values.color }}>
          <span className="kpi-group-preview-bar__swatch" style={{ backgroundColor: values.color }} />
          <strong>{values.name.trim() || 'Xem trước nhóm KPI'}</strong>
          <code>{values.code.trim() || 'MA_NHOM'}</code>
        </div>
      </section>
    </div>
  );
}

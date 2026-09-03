'use client';

import { KpiGroupScopePicker } from '@/components/kpi-groups/KpiGroupScopePicker';
import type { StaffDepartmentRow, StaffOrgPositionRow, StaffTeamRow } from '@/lib/api';
import type { KpiTypeFormFieldErrors, KpiTypeFormValues } from '@/lib/kpi-type-form.util';
import { normalizeKpiTypeCode } from '@/lib/kpi-type-form.util';
import {
  KPI_TYPE_CALC_LABELS,
  KPI_TYPE_DIRECTION_LABELS,
  KPI_TYPE_TARGET_MODE_LABELS,
  KPI_TYPE_VALUE_TYPE_LABELS,
  kpiTypeErrorMessage,
  type KpiTypeCalculationMode,
  type KpiTypeDirection,
  type KpiTypeTargetMode,
  type KpiTypeValueType,
} from '@/lib/kpi-type-util';
import type { KpiTypeSource, KpiTypeUnit } from '@/lib/kpi-types-api';
import type { KpiGroupListItem } from '@/lib/kpi-groups-api';

type Props = {
  values: KpiTypeFormValues;
  errors: KpiTypeFormFieldErrors;
  groups: KpiGroupListItem[];
  units: KpiTypeUnit[];
  sources: KpiTypeSource[];
  departments: StaffDepartmentRow[];
  positions: StaffOrgPositionRow[];
  teams: StaffTeamRow[];
  disabled?: boolean;
  onChange: (next: KpiTypeFormValues) => void;
  onGroupChangeRequest: (groupId: string) => void;
};

function fieldError(errors: KpiTypeFormFieldErrors, key: keyof KpiTypeFormValues) {
  const code = errors[key];
  if (!code) return undefined;
  return kpiTypeErrorMessage(code);
}

export function KpiTypeForm({
  values,
  errors,
  groups,
  units,
  sources,
  departments,
  positions,
  teams,
  disabled,
  onChange,
  onGroupChangeRequest,
}: Props) {
  function patch(partial: Partial<KpiTypeFormValues>) {
    onChange({ ...values, ...partial });
  }

  const auto = values.calculation_mode !== 'MANUAL';

  return (
    <div className="kpi-type-form-sections">
      <section className="kpi-type-form-section">
        <h2 className="kpi-type-form-section__title">1. Thông tin cơ bản</h2>
        <div className="kpi-type-form-grid">
          <label>
            Nhóm KPI <span className="required">*</span>
            <select
              className="kpi-select"
              value={values.kpi_group_id}
              disabled={disabled}
              onChange={(e) => onGroupChangeRequest(e.target.value)}
            >
              <option value="">— Chọn Nhóm KPI đang hoạt động —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
            {fieldError(errors, 'kpi_group_id') ? <span className="error">{fieldError(errors, 'kpi_group_id')}</span> : null}
          </label>
          <label>
            Mã KPI Type <span className="required">*</span>
            <input
              className="kpi-input"
              value={values.code}
              disabled={disabled}
              onChange={(e) => patch({ code: normalizeKpiTypeCode(e.target.value) })}
              placeholder="MQL_COUNT"
            />
            {fieldError(errors, 'code') ? <span className="error">{fieldError(errors, 'code')}</span> : null}
          </label>
          <label>
            Tên KPI Type <span className="required">*</span>
            <input
              className="kpi-input"
              value={values.name}
              disabled={disabled}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Marketing Qualified Leads (MQL)"
            />
            {fieldError(errors, 'name') ? <span className="error">{fieldError(errors, 'name')}</span> : null}
          </label>
          <label>
            Tên viết tắt
            <input
              className="kpi-input"
              value={values.short_name}
              maxLength={50}
              disabled={disabled}
              onChange={(e) => patch({ short_name: e.target.value })}
              placeholder="MQL"
            />
          </label>
          <label className="kpi-type-form-grid__full">
            Mô tả nghiệp vụ
            <textarea
              className="kpi-input"
              rows={3}
              maxLength={1000}
              value={values.description}
              disabled={disabled}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <span className="kpi-type-char-counter">{values.description.length}/1000</span>
          </label>
        </div>
      </section>

      <section className="kpi-type-form-section">
        <h2 className="kpi-type-form-section__title">2. Đơn vị &amp; hướng đo</h2>
        <div className="kpi-type-form-grid">
          <label>
            Hướng đo <span className="required">*</span>
            <select
              className="kpi-select"
              value={values.direction}
              disabled={disabled}
              onChange={(e) => patch({ direction: e.target.value as KpiTypeDirection })}
            >
              {(Object.keys(KPI_TYPE_DIRECTION_LABELS) as KpiTypeDirection[]).map((d) => (
                <option key={d} value={d}>
                  {KPI_TYPE_DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kiểu giá trị <span className="required">*</span>
            <select
              className="kpi-select"
              value={values.value_type}
              disabled={disabled}
              onChange={(e) => patch({ value_type: e.target.value as KpiTypeValueType })}
            >
              {(Object.keys(KPI_TYPE_VALUE_TYPE_LABELS) as KpiTypeValueType[]).map((v) => (
                <option key={v} value={v}>
                  {KPI_TYPE_VALUE_TYPE_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Đơn vị đo <span className="required">*</span>
            <select
              className="kpi-select"
              value={values.unit_id}
              disabled={disabled}
              onChange={(e) => patch({ unit_id: e.target.value })}
            >
              <option value="">— Chọn —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
            {fieldError(errors, 'unit_id') ? <span className="error">{fieldError(errors, 'unit_id')}</span> : null}
          </label>
          <label>
            Số chữ số thập phân
            <input
              className="kpi-input"
              type="number"
              min={0}
              max={4}
              value={values.decimal_places}
              disabled={disabled}
              onChange={(e) => patch({ decimal_places: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="kpi-type-form-section">
        <h2 className="kpi-type-form-section__title">3. Mục tiêu mặc định</h2>
        <div className="kpi-type-segmented" role="tablist">
          {(Object.keys(KPI_TYPE_TARGET_MODE_LABELS) as KpiTypeTargetMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`kpi-type-segmented__btn${values.target_mode === mode ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => patch({ target_mode: mode })}
            >
              {KPI_TYPE_TARGET_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <div className="kpi-type-form-grid" style={{ marginTop: '0.85rem' }}>
          {values.target_mode !== 'SINGLE_TARGET' ? (
            <label>
              Ngưỡng tối thiểu
              <input
                className="kpi-input"
                value={values.minimum_target}
                disabled={disabled}
                onChange={(e) => patch({ minimum_target: e.target.value })}
              />
            </label>
          ) : null}
          <label>
            Mục tiêu mặc định <span className="required">*</span>
            <input
              className="kpi-input"
              value={values.default_target}
              disabled={disabled}
              onChange={(e) => patch({ default_target: e.target.value })}
            />
            {fieldError(errors, 'default_target') ? (
              <span className="error">{fieldError(errors, 'default_target')}</span>
            ) : null}
          </label>
          {values.target_mode === 'THRESHOLD' ? (
            <label>
              Mục tiêu vượt kỳ vọng
              <input
                className="kpi-input"
                value={values.stretch_target}
                disabled={disabled}
                onChange={(e) => patch({ stretch_target: e.target.value })}
              />
            </label>
          ) : null}
          {values.target_mode === 'RANGE' ? (
            <>
              <label>
                Giới hạn dưới
                <input
                  className="kpi-input"
                  value={values.lower_limit}
                  disabled={disabled}
                  onChange={(e) => patch({ lower_limit: e.target.value })}
                />
              </label>
              <label>
                Giới hạn trên
                <input
                  className="kpi-input"
                  value={values.upper_limit}
                  disabled={disabled}
                  onChange={(e) => patch({ upper_limit: e.target.value })}
                />
              </label>
            </>
          ) : null}
        </div>
        {values.target_mode === 'THRESHOLD' ? (
          <div className="kpi-type-target-bar" aria-hidden>
            <span>Min {values.minimum_target || '—'}</span>
            <span>Target {values.default_target || '—'}</span>
            <span>Stretch {values.stretch_target || '—'}</span>
          </div>
        ) : null}
      </section>

      <section className="kpi-type-form-section">
        <h2 className="kpi-type-form-section__title">4. Cách tính &amp; dữ liệu</h2>
        <div className="kpi-type-segmented">
          {(Object.keys(KPI_TYPE_CALC_LABELS) as KpiTypeCalculationMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`kpi-type-segmented__btn${values.calculation_mode === mode ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() =>
                patch({
                  calculation_mode: mode,
                  manual_evidence_required: mode === 'MANUAL',
                })
              }
            >
              {KPI_TYPE_CALC_LABELS[mode]}
            </button>
          ))}
        </div>
        {auto ? (
          <div className="kpi-type-form-grid" style={{ marginTop: '0.85rem' }}>
            <label>
              Nguồn dữ liệu chính <span className="required">*</span>
              <select
                className="kpi-select"
                value={values.primary_data_source_id}
                disabled={disabled}
                onChange={(e) => patch({ primary_data_source_id: e.target.value })}
              >
                <option value="">— Chọn —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.health})
                  </option>
                ))}
              </select>
              {fieldError(errors, 'primary_data_source_id') ? (
                <span className="error">{fieldError(errors, 'primary_data_source_id')}</span>
              ) : null}
            </label>
            <label>
              Đối tượng dữ liệu
              <input
                className="kpi-input"
                value={values.data_entity}
                disabled={disabled}
                onChange={(e) => patch({ data_entity: e.target.value })}
                placeholder="Lead"
              />
            </label>
            <label>
              Kiểu tổng hợp
              <select
                className="kpi-select"
                value={values.aggregation_type}
                disabled={disabled}
                onChange={(e) => patch({ aggregation_type: e.target.value })}
              >
                {['COUNT', 'SUM', 'AVG', 'RATE', 'DISTINCT_COUNT', 'CUSTOM'].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tần suất đồng bộ
              <select
                className="kpi-select"
                value={values.sync_frequency}
                disabled={disabled}
                onChange={(e) => patch({ sync_frequency: e.target.value })}
              >
                {['REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="kpi-type-form-grid__full">
              Công thức
              <textarea
                className="kpi-input kpi-type-formula"
                rows={3}
                value={values.formula_expression}
                disabled={disabled}
                onChange={(e) => patch({ formula_expression: e.target.value })}
                placeholder="COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)"
              />
              {fieldError(errors, 'formula_expression') ? (
                <span className="error">{fieldError(errors, 'formula_expression')}</span>
              ) : null}
            </label>
            <label className="kpi-type-form-grid__full">
              Diễn giải công thức
              <input
                className="kpi-input"
                value={values.formula_display}
                disabled={disabled}
                onChange={(e) => patch({ formula_display: e.target.value })}
              />
            </label>
            <label>
              Chia cho 0
              <select
                className="kpi-select"
                value={values.divide_by_zero_fallback}
                disabled={disabled}
                onChange={(e) =>
                  patch({ divide_by_zero_fallback: e.target.value as KpiTypeFormValues['divide_by_zero_fallback'] })
                }
              >
                <option value="ERROR">ERROR</option>
                <option value="ZERO">ZERO</option>
                <option value="NA">NA</option>
              </select>
            </label>
          </div>
        ) : (
          <label className="kpi-type-check" style={{ marginTop: '0.85rem' }}>
            <input
              type="checkbox"
              checked={values.manual_evidence_required}
              disabled={disabled}
              onChange={(e) => patch({ manual_evidence_required: e.target.checked })}
            />
            Yêu cầu minh chứng nhập tay
          </label>
        )}
      </section>

      <section className="kpi-type-form-section">
        <h2 className="kpi-type-form-section__title">5. Phạm vi &amp; khuyến nghị</h2>
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
            const next: Partial<KpiTypeFormValues> = { scope_type };
            if (scope_type === 'ORGANIZATION') {
              next.department_ids = [];
              next.position_ids = [];
            }
            patch(next);
          }}
          onDepartmentIdsChange={(department_ids) => patch({ department_ids })}
          onPositionIdsChange={(position_ids) => patch({ position_ids })}
        />
        <div className="kpi-type-form-grid" style={{ marginTop: '0.85rem' }}>
          <label>
            Trọng số tối thiểu
            <input
              className="kpi-input"
              value={values.weight_min}
              disabled={disabled}
              onChange={(e) => patch({ weight_min: e.target.value })}
            />
            {fieldError(errors, 'weight_min') ? <span className="error">{fieldError(errors, 'weight_min')}</span> : null}
          </label>
          <label>
            Trọng số tối đa
            <input
              className="kpi-input"
              value={values.weight_max}
              disabled={disabled}
              onChange={(e) => patch({ weight_max: e.target.value })}
            />
          </label>
          <label>
            Thứ tự hiển thị
            <input
              className="kpi-input"
              type="number"
              min={1}
              value={values.display_order}
              disabled={disabled}
              onChange={(e) => patch({ display_order: Number(e.target.value) || '' })}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

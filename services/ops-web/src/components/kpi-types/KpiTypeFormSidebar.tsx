'use client';

import { KpiTypeStatusBadge } from '@/components/kpi-types/KpiTypeStatusBadge';
import { kpiTypeFormChecklist, type KpiTypeFormValues } from '@/lib/kpi-type-form.util';
import {
  KPI_TYPE_VALIDATION_LABELS,
  labelKpiTypeCalc,
  labelKpiTypeDirection,
  labelKpiTypeScope,
  type KpiTypeValidationStatus,
} from '@/lib/kpi-type-util';
import type { KpiGroupListItem } from '@/lib/kpi-groups-api';
import type { KpiTypeUnit } from '@/lib/kpi-types-api';

export function KpiTypeFormSidebar({
  values,
  groups,
  units,
  validationStatus,
  usageCount,
  preview,
}: {
  values: KpiTypeFormValues;
  groups: KpiGroupListItem[];
  units: KpiTypeUnit[];
  validationStatus?: KpiTypeValidationStatus;
  usageCount?: number;
  preview?: { formatted_value: string | null } | null;
}) {
  const group = groups.find((g) => g.id === values.kpi_group_id);
  const unit = units.find((u) => u.id === values.unit_id);
  const checklist = kpiTypeFormChecklist(values);

  return (
    <aside className="kpi-type-form-sidebar">
      <section className="kpi-type-form-sidebar__section">
        <h3>Xem trước</h3>
        <div className="kpi-type-preview-card">
          <strong>{values.name.trim() || 'Tên KPI Type'}</strong>
          <span className="muted">{values.code.trim() || 'MA_KPI_TYPE'}</span>
          <p>{group?.name ?? 'Chưa chọn nhóm'}</p>
          <p>
            {values.direction ? labelKpiTypeDirection(values.direction) : '—'} · {unit?.name ?? '—'}
          </p>
          <KpiTypeStatusBadge status={values.status} />
        </div>
      </section>
      <section className="kpi-type-form-sidebar__section">
        <h3>Checklist kích hoạt</h3>
        <ul className="kpi-type-checklist">
          {checklist.map((item) => (
            <li key={item.id} className={item.ok ? 'is-ok' : 'is-pending'}>
              {item.ok ? '✓' : '○'} {item.label}
            </li>
          ))}
        </ul>
        <p className="muted">KPI Type chỉ hiện khi tạo chỉ tiêu nếu trạng thái Đang hoạt động.</p>
      </section>
      <section className="kpi-type-form-sidebar__section">
        <h3>Tóm tắt</h3>
        <dl className="kpi-type-form-sidebar__dl">
          <div>
            <dt>Phạm vi</dt>
            <dd>{labelKpiTypeScope(values.scope_type)}</dd>
          </div>
          <div>
            <dt>Cách tính</dt>
            <dd>{labelKpiTypeCalc(values.calculation_mode)}</dd>
          </div>
          <div>
            <dt>Công thức</dt>
            <dd>
              {validationStatus
                ? KPI_TYPE_VALIDATION_LABELS[validationStatus]
                : 'Chưa kiểm tra'}
            </dd>
          </div>
          {preview?.formatted_value ? (
            <div>
              <dt>Preview</dt>
              <dd>{preview.formatted_value}</dd>
            </div>
          ) : null}
          {usageCount != null ? (
            <div>
              <dt>Đang sử dụng</dt>
              <dd>{usageCount.toLocaleString('vi-VN')}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </aside>
  );
}

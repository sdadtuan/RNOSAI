'use client';

import type { KpiGroupFormValues } from '@/lib/kpi-group-form.util';
import { kpiGroupFormChecklist } from '@/lib/kpi-group-form.util';
import {
  labelKpiGroupDirection,
  labelKpiGroupScope,
  labelKpiGroupStatus,
  KPI_GROUP_DIRECTION_LABELS,
} from '@/lib/kpi-group-util';
import { KpiGroupStatusBadge } from '@/components/kpi-groups/KpiGroupStatusBadge';

type KpiGroupFormSidebarProps = {
  values: KpiGroupFormValues;
  usageCount?: number;
  isEdit?: boolean;
};

export function KpiGroupFormSidebar({ values, usageCount = 0, isEdit }: KpiGroupFormSidebarProps) {
  const checklist = kpiGroupFormChecklist(values);

  return (
    <aside className="kpi-group-form-sidebar">
      <section className="kpi-group-form-sidebar__section">
        <h3>Tóm tắt cấu hình</h3>
        <dl className="kpi-group-form-sidebar__dl">
          <div>
            <dt>Mã</dt>
            <dd>{values.code.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Tên</dt>
            <dd>{values.name.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Phạm vi</dt>
            <dd>{labelKpiGroupScope(values.scope_type)}</dd>
          </div>
          <div>
            <dt>Hướng đo</dt>
            <dd>{values.default_direction ? labelKpiGroupDirection(values.default_direction) : '—'}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <KpiGroupStatusBadge status={values.status} />
            </dd>
          </div>
          {isEdit ? (
            <div>
              <dt>Chỉ tiêu đang dùng</dt>
              <dd>{usageCount.toLocaleString('vi-VN')}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="kpi-group-form-sidebar__section">
        <h3>Xem trước</h3>
        <div className="kpi-group-preview-bar" style={{ borderColor: values.color }}>
          <span className="kpi-group-preview-bar__swatch" style={{ backgroundColor: values.color }} />
          <div>
            <strong>{values.name.trim() || 'Tên Nhóm KPI'}</strong>
            <span className="muted">{values.code.trim() || 'MA_NHOM'}</span>
          </div>
          {values.default_direction ? (
            <span className="kpi-group-preview-bar__direction">
              {KPI_GROUP_DIRECTION_LABELS[values.default_direction]}
            </span>
          ) : null}
        </div>
      </section>

      <section className="kpi-group-form-sidebar__section">
        <h3>Checklist</h3>
        <ul className="kpi-group-checklist">
          {checklist.map((item) => (
            <li key={item.id} className={item.ok ? 'is-ok' : 'is-pending'}>
              {item.ok ? '✓' : '○'} {item.label}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

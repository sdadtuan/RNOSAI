'use client';

import type { ServiceKpiTemplateListItem, ServiceKpiTemplateRule } from '@/lib/service-kpi-types';

const CLASS_LABEL: Record<string, string> = {
  COMMITTED_DELIVERABLE: 'Cam kết',
  QUALITY_STANDARD: 'Quality',
  OPTIMIZATION_TARGET: 'Tối ưu',
  PROJECTED_RESULT: 'Dự kiến',
  BUSINESS_OUTCOME: 'Kết quả KD',
  INTERNAL_OPERATIONAL: 'Nội bộ',
};

const CLASS_BADGE: Record<string, string> = {
  COMMITTED_DELIVERABLE: 'blue',
  QUALITY_STANDARD: 'green',
  OPTIMIZATION_TARGET: 'purple',
  PROJECTED_RESULT: 'amber',
  BUSINESS_OUTCOME: 'amber',
  INTERNAL_OPERATIONAL: 'gray',
};

type Props = {
  template: ServiceKpiTemplateListItem;
  onSubmitReview?: (versionId: string) => void;
  submitting?: boolean;
};

export function ServiceKpiTemplateBuilder({ template, onSubmitReview, submitting }: Props) {
  const rules = template.current_version?.rules ?? [];
  const deliverable = rules.filter((r) => r.classification === 'COMMITTED_DELIVERABLE');
  const performance = rules.filter((r) =>
    ['OPTIMIZATION_TARGET', 'PROJECTED_RESULT', 'BUSINESS_OUTCOME'].includes(r.classification),
  );
  const internal = rules.filter((r) => r.classification === 'INTERNAL_OPERATIONAL');

  function renderGroup(title: string, items: ServiceKpiTemplateRule[]) {
    if (!items.length) return null;
    return (
      <section className="kpi-hub-skpi-group">
        <h3 className="kpi-hub-skpi-group__title">{title}</h3>
        {items.map((rule, idx) => (
          <div key={rule.id ?? `${rule.dictionary_id}-${idx}`} className="kpi-hub-skpi-rule">
            <span className="kpi-hub-skpi-rule__no">{String(idx + 1).padStart(2, '0')}</span>
            <div className="kpi-hub-skpi-rule__main">
              <strong>{rule.dictionary_id}</strong>
              <span className={`kpi-hub-badge kpi-hub-badge--${CLASS_BADGE[rule.classification] ?? 'gray'}`}>
                {CLASS_LABEL[rule.classification] ?? rule.classification}
              </span>
            </div>
            <div className="kpi-hub-skpi-rule__target">
              {rule.target_min != null || rule.target_max != null
                ? `${rule.target_min ?? '—'} – ${rule.target_max ?? '—'}`
                : '—'}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="kpi-hub-skpi-builder">
      <div className="kpi-hub-notice">
        Template lifecycle: Active chỉ sửa bằng version Draft mới. Quote giữ KPI Snapshot theo version cũ.
      </div>
      {renderGroup('Cam kết bàn giao', deliverable)}
      {renderGroup('Performance & Forecast', performance)}
      {renderGroup('Vận hành nội bộ', internal)}
      {!rules.length ? <p className="kpi-hub-empty">Chưa có rule — thêm KPI từ Dictionary.</p> : null}
      {template.current_version && onSubmitReview ? (
        <div className="kpi-hub-skpi-builder__actions">
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={submitting || template.status === 'ACTIVE'}
            onClick={() => onSubmitReview(template.current_version!.id)}
          >
            {submitting ? 'Đang gửi…' : 'Gửi duyệt (Submit review)'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

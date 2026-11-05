'use client';

import { useMemo } from 'react';
import { CLASSIFICATION_GROUP_LABELS } from '@/lib/service-kpi-copy';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import type { ServiceKpiTemplateListItem, ServiceKpiTemplateRule } from '@/lib/service-kpi-types';
import { SkpiClassificationBadge } from './SkpiClassificationBadge';
import { SkpiNotice } from './SkpiNotice';

type Props = {
  open: boolean;
  template: ServiceKpiTemplateListItem | null;
  dictionary?: KpiHubDictionaryRow[];
  onClose: () => void;
  onSubmitReview?: () => void;
  submitting?: boolean;
};

function groupRules(rules: ServiceKpiTemplateRule[]): Array<{ key: string; label: string; rules: ServiceKpiTemplateRule[] }> {
  const order = [
    'COMMITTED_DELIVERABLE',
    'QUALITY_STANDARD',
    'OPTIMIZATION_TARGET',
    'PROJECTED_RESULT',
    'BUSINESS_OUTCOME',
    'INTERNAL_OPERATIONAL',
  ];
  const map = new Map<string, ServiceKpiTemplateRule[]>();
  for (const rule of rules) {
    const list = map.get(rule.classification) ?? [];
    list.push(rule);
    map.set(rule.classification, list);
  }
  return order
    .filter((k) => map.has(k))
    .map((k) => ({
      key: k,
      label: CLASSIFICATION_GROUP_LABELS[k] ?? k,
      rules: map.get(k)!,
    }));
}

export function SkpiTemplateDetailModal({
  open,
  template,
  dictionary = [],
  onClose,
  onSubmitReview,
  submitting,
}: Props) {
  const dictMap = useMemo(() => {
    const m = new Map<string, KpiHubDictionaryRow>();
    for (const d of dictionary) m.set(d.id, d);
    return m;
  }, [dictionary]);

  if (!open || !template) return null;

  const rules = template.current_version?.rules ?? [];
  const groups = groupRules(rules);
  let rowNo = 0;

  return (
    <div className="kpi-hub-skpi-modal-bg" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="kpi-hub-skpi-modal" onClick={(e) => e.stopPropagation()}>
        <header className="kpi-hub-skpi-modal__head">
          <h2>SKPI-02 — Cấu hình Template — {template.name}</h2>
          <button type="button" className="kpi-hub-skpi-modal__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-skpi-modal__body">
          <SkpiNotice title="Template lifecycle:">
            Active Template chỉ sửa bằng version Draft mới. Quote/Project giữ KPI Snapshot theo version cũ.
          </SkpiNotice>
          <div className="kpi-hub-skpi-kpi-groups">
            {groups.length ? (
              groups.map((group) => (
                <div key={group.key}>
                  <div className="kpi-hub-skpi-kpi-group">{group.label}</div>
                  {group.rules.map((rule) => {
                    rowNo += 1;
                    const dict = dictMap.get(rule.dictionary_id);
                    const name = dict?.name ?? rule.dictionary_id;
                    const target =
                      rule.target_min != null && rule.target_max != null
                        ? `${rule.target_min}–${rule.target_max}`
                        : (rule.target_max ?? rule.target_min ?? '—');
                    return (
                      <div key={`${rule.dictionary_id}-${rowNo}`} className="kpi-hub-skpi-kpi-row">
                        <span className="kpi-hub-skpi-kpi-row__no">{String(rowNo).padStart(2, '0')}</span>
                        <div className="kpi-hub-skpi-kpi-row__name">
                          <b>{dict?.code ?? rule.dictionary_id}</b>
                          <span>{name}</span>
                        </div>
                        <SkpiClassificationBadge classification={rule.classification} />
                        <div className="kpi-hub-skpi-kpi-row__target">
                          <b>{target}</b>
                        </div>
                        <span>{rule.is_required === false ? 'Optional' : 'Ready'}</span>
                        <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm">
                          Sửa
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="kpi-hub-muted">Chưa có rule — thêm KPI từ Dictionary.</p>
            )}
          </div>
        </div>
        <footer className="kpi-hub-skpi-modal__foot">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          {onSubmitReview ? (
            <button
              type="button"
              className="kpi-hub-btn kpi-hub-btn--primary"
              disabled={submitting}
              onClick={onSubmitReview}
            >
              {submitting ? 'Đang gửi…' : 'Submit review'}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

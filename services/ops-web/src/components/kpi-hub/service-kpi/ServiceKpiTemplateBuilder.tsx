'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import type { ServiceKpiTemplateListItem, ServiceKpiTemplateRule, SkpiClassification } from '@/lib/service-kpi-types';

const CLASSIFICATIONS: SkpiClassification[] = [
  'COMMITTED_DELIVERABLE',
  'QUALITY_STANDARD',
  'OPTIMIZATION_TARGET',
  'PROJECTED_RESULT',
  'BUSINESS_OUTCOME',
  'INTERNAL_OPERATIONAL',
];

const CLASS_LABEL: Record<string, string> = {
  COMMITTED_DELIVERABLE: 'Cam kết',
  QUALITY_STANDARD: 'Quality',
  OPTIMIZATION_TARGET: 'Tối ưu',
  PROJECTED_RESULT: 'Dự kiến',
  BUSINESS_OUTCOME: 'Kết quả KD',
  INTERNAL_OPERATIONAL: 'Nội bộ',
};

type Props = {
  template: ServiceKpiTemplateListItem;
  dictionary?: KpiHubDictionaryRow[];
  editable?: boolean;
  onSaveRules?: (rules: ServiceKpiTemplateRule[]) => Promise<void>;
  onSubmitReview?: (versionId: string) => void;
  onActivate?: (versionId: string) => void;
  submitting?: boolean;
  saving?: boolean;
  canPublish?: boolean;
};

export function ServiceKpiTemplateBuilder({
  template,
  dictionary = [],
  editable = false,
  onSaveRules,
  onSubmitReview,
  onActivate,
  submitting,
  saving,
  canPublish,
}: Props) {
  const version = template.current_version;
  const isDraft = template.status === 'DRAFT';
  const isInReview = template.status === 'IN_REVIEW';

  const [rules, setRules] = useState<ServiceKpiTemplateRule[]>(version?.rules ?? []);
  const [addKpiId, setAddKpiId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setRules(version?.rules ?? []);
  }, [version?.id, version?.rules]);

  const dictLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of dictionary) map.set(d.id, `${d.code} — ${d.name}`);
    return map;
  }, [dictionary]);

  const availableKpis = useMemo(
    () => dictionary.filter((d) => d.status === 'ACTIVE' && !rules.some((r) => r.dictionary_id === d.id)),
    [dictionary, rules],
  );

  function updateRule(index: number, patch: Partial<ServiceKpiTemplateRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function addRule() {
    if (!addKpiId) return;
    const row = dictionary.find((d) => d.id === addKpiId);
    const classification: SkpiClassification =
      row?.group === 'FINANCE' ? 'INTERNAL_OPERATIONAL' : 'OPTIMIZATION_TARGET';
    setRules((prev) => [
      ...prev,
      {
        dictionary_id: addKpiId,
        classification,
        client_visible: classification !== 'INTERNAL_OPERATIONAL',
        assumption_template: 'Phụ thuộc thị trường, creative và sales SLA.',
        disclaimer_template:
          classification !== 'INTERNAL_OPERATIONAL'
            ? 'Kết quả là mục tiêu tối ưu, không phải cam kết.'
            : '',
        owner_role: template.owner_team || 'Performance MKT',
      },
    ]);
    setAddKpiId('');
  }

  async function handleSave() {
    if (!onSaveRules) return;
    setSaveError(null);
    try {
      await onSaveRules(rules);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Lưu rule thất bại');
    }
  }

  return (
    <div className="kpi-hub-skpi-builder">
      <div className="kpi-hub-notice">
        Template lifecycle: Active chỉ sửa bằng version Draft mới. Quote giữ KPI Snapshot theo version cũ.
      </div>

      {editable && isDraft && availableKpis.length ? (
        <div className="kpi-hub-skpi-builder__add" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select className="kpi-hub-field" value={addKpiId} onChange={(e) => setAddKpiId(e.target.value)}>
            <option value="">+ Thêm KPI từ Dictionary</option>
            {availableKpis.map((k) => (
              <option key={k.id} value={k.id}>
                {k.code} — {k.name}
              </option>
            ))}
          </select>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled={!addKpiId} onClick={addRule}>
            Thêm
          </button>
        </div>
      ) : null}

      {!rules.length ? <p className="kpi-hub-empty">Chưa có rule — thêm KPI từ Dictionary.</p> : null}

      {rules.map((rule, idx) => (
        <div key={`${rule.dictionary_id}-${idx}`} className="kpi-hub-skpi-rule kpi-hub-skpi-rule--edit">
          <span className="kpi-hub-skpi-rule__no">{String(idx + 1).padStart(2, '0')}</span>
          <div className="kpi-hub-skpi-rule__main">
            <strong>{dictLabel.get(rule.dictionary_id) ?? rule.dictionary_id}</strong>
            {editable && isDraft ? (
              <select
                value={rule.classification}
                onChange={(e) => updateRule(idx, { classification: e.target.value as SkpiClassification })}
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
            ) : (
              <span className="kpi-hub-badge kpi-hub-badge--purple">
                {CLASS_LABEL[rule.classification] ?? rule.classification}
              </span>
            )}
          </div>
          {editable && isDraft ? (
            <div className="kpi-hub-skpi-rule__fields">
              <input
                type="number"
                placeholder="Target min"
                value={rule.target_min ?? ''}
                onChange={(e) =>
                  updateRule(idx, { target_min: e.target.value ? Number(e.target.value) : undefined })
                }
              />
              <input
                type="number"
                placeholder="Target max"
                value={rule.target_max ?? ''}
                onChange={(e) =>
                  updateRule(idx, { target_max: e.target.value ? Number(e.target.value) : undefined })
                }
              />
              <input
                placeholder="Disclaimer"
                value={rule.disclaimer_template ?? ''}
                onChange={(e) => updateRule(idx, { disclaimer_template: e.target.value })}
              />
              <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm" onClick={() => removeRule(idx)}>
                Xóa
              </button>
            </div>
          ) : (
            <div className="kpi-hub-skpi-rule__target">
              {rule.target_min != null || rule.target_max != null
                ? `${rule.target_min ?? '—'} – ${rule.target_max ?? '—'}`
                : '—'}
            </div>
          )}
        </div>
      ))}

      {saveError ? <p className="kpi-hub-form-error">{saveError}</p> : null}

      <div className="kpi-hub-skpi-builder__actions">
        {editable && isDraft && onSaveRules ? (
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled={saving || !rules.length} onClick={() => void handleSave()}>
            {saving ? 'Đang lưu…' : 'Lưu rules'}
          </button>
        ) : null}
        {version && onSubmitReview && isDraft ? (
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={submitting || !rules.length}
            onClick={() => onSubmitReview(version.id)}
          >
            {submitting ? 'Đang gửi…' : 'Gửi duyệt (Submit review)'}
          </button>
        ) : null}
        {version && onActivate && isInReview && canPublish ? (
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={submitting}
            onClick={() => onActivate(version.id)}
          >
            {submitting ? 'Đang kích hoạt…' : 'Activate template'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { fetchServiceKpiMeasurementPlan, upsertServiceKpiMeasurementPlan } from '@/lib/service-kpi-api';
import type { ServiceKpiInstanceItem, ServiceKpiMeasurementPlan } from '@/lib/service-kpi-types';

type Props = {
  token: string;
  instances: ServiceKpiInstanceItem[];
  dictionaryLabels?: Record<string, string>;
};

const CADENCES = ['daily', 'weekly', 'monthly'] as const;

export function ServiceKpiMeasurementPlanForm({ token, instances, dictionaryLabels = {} }: Props) {
  const [instanceId, setInstanceId] = useState('');
  const [plan, setPlan] = useState<ServiceKpiMeasurementPlan | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [cadence, setCadence] = useState('weekly');
  const [dataSource, setDataSource] = useState('');
  const [fieldMapping, setFieldMapping] = useState('');
  const [freshnessHours, setFreshnessHours] = useState('24');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId && instances.length) setInstanceId(instances[0]!.id);
  }, [instances, instanceId]);

  useEffect(() => {
    if (!token || !instanceId) {
      setPlan(null);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchServiceKpiMeasurementPlan(token, instanceId)
      .then((p) => {
        setPlan(p);
        setOwnerName(p.owner_name ?? '');
        setCadence(p.cadence ?? 'weekly');
        setDataSource(p.data_source ?? '');
        setFieldMapping(p.field_mapping ?? '');
        setFreshnessHours(String(p.freshness_sla_hours ?? 24));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải plan'))
      .finally(() => setLoading(false));
  }, [token, instanceId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !instanceId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await upsertServiceKpiMeasurementPlan(token, instanceId, {
        owner_name: ownerName.trim() || 'AM',
        cadence,
        data_source: dataSource,
        field_mapping: fieldMapping,
        freshness_sla_hours: Number(freshnessHours) || 24,
      });
      setMessage('Đã lưu Measurement Plan');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lưu plan thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (!instances.length) {
    return <p className="kpi-hub-empty">Chưa có KPI instance — tạo instance hoặc thêm DV vào Quote.</p>;
  }

  const selected = instances.find((i) => i.id === instanceId);

  return (
    <form className="kpi-hub-skpi-measurement-form" onSubmit={(e) => void handleSave(e)}>
      <div className="kpi-hub-skpi-measurement-form__layout">
        <div className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h2>Measurement Plan</h2>
            {plan?.qa_status ? (
              <span className={`kpi-hub-badge kpi-hub-badge--${plan.qa_status === 'pending' ? 'amber' : 'gray'}`}>
                QA: {plan.qa_status}
              </span>
            ) : null}
          </header>
          <div className="kpi-hub-card__body">
            <label className="kpi-hub-field">
              <span>KPI Instance *</span>
              <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {dictionaryLabels[inst.dictionary_id] ?? inst.dictionary_id} · {inst.source_id}
                  </option>
                ))}
              </select>
            </label>
            {loading ? <p className="kpi-hub-muted">Đang tải plan…</p> : null}
            <label className="kpi-hub-field">
              <span>KPI Owner</span>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nguyễn Kiều · Performance MKT" />
            </label>
            <label className="kpi-hub-field">
              <span>Cadence</span>
              <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="kpi-hub-field">
              <span>Data Source</span>
              <input value={dataSource} onChange={(e) => setDataSource(e.target.value)} placeholder="Meta Ads API + CRM Core" />
            </label>
            <label className="kpi-hub-field">
              <span>Freshness SLA (giờ)</span>
              <input value={freshnessHours} onChange={(e) => setFreshnessHours(e.target.value)} type="number" min={1} />
            </label>
            <label className="kpi-hub-field">
              <span>Source field mapping</span>
              <textarea
                value={fieldMapping}
                onChange={(e) => setFieldMapping(e.target.value)}
                rows={5}
                placeholder={'ad_spend = Meta Ads Insights.spend\nvalid_leads = CRM Lead WHERE is_valid = true'}
              />
            </label>
            {error ? <p className="kpi-hub-form-error">{error}</p> : null}
            {message ? <p className="kpi-hub-notice kpi-hub-notice--success">{message}</p> : null}
            <button type="submit" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu Measurement Plan'}
            </button>
          </div>
        </div>
        <aside className="kpi-hub-card kpi-hub-skpi-readiness">
          <header className="kpi-hub-card__head">
            <h2>Readiness</h2>
          </header>
          <div className="kpi-hub-card__body">
            <ul className="kpi-hub-skpi-readiness-list">
              <li className={selected?.readiness_level === 'pass' ? 'is-ok' : ''}>Definition/formula</li>
              <li className={fieldMapping.trim() ? 'is-ok' : 'is-warn'}>Source mapping</li>
              <li className={ownerName.trim() ? 'is-ok' : 'is-warn'}>Owner/cadence</li>
              <li>Freshness SLA: {freshnessHours}h</li>
              <li>QA: {plan?.qa_status ?? 'draft'}</li>
            </ul>
          </div>
        </aside>
      </div>
    </form>
  );
}

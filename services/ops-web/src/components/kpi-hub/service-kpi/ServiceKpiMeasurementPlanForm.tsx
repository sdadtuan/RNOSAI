'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { ZERO_DENOMINATOR_VAR } from '@/lib/service-kpi-copy';
import { fetchServiceKpiMeasurementPlan, upsertServiceKpiMeasurementPlan } from '@/lib/service-kpi-api';
import type { ServiceKpiInstanceItem, ServiceKpiMeasurementPlan } from '@/lib/service-kpi-types';
import { SkpiFormulaBlock } from './SkpiFormulaBlock';
import { SkpiTwoColumnLayout } from './SkpiTwoColumnLayout';

type Props = {
  token: string;
  instances: ServiceKpiInstanceItem[];
  dictionaryLabels?: Record<string, string>;
  dictionaryRows?: KpiHubDictionaryRow[];
};

const CADENCES = ['daily', 'weekly', 'monthly'] as const;

export function ServiceKpiMeasurementPlanForm({
  token,
  instances,
  dictionaryLabels = {},
  dictionaryRows = [],
}: Props) {
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

  const selected = instances.find((i) => i.id === instanceId);
  const dictEntry = useMemo(
    () => dictionaryRows.find((d) => d.id === selected?.dictionary_id),
    [dictionaryRows, selected?.dictionary_id],
  );

  const formulaVars = useMemo(() => {
    const vars: Array<{ name: string; detail: string }> = [];
    if (dictEntry?.formulaDisplay) {
      vars.push({ name: dictEntry.code, detail: dictEntry.formulaDisplay });
    }
    if (fieldMapping.trim()) {
      for (const line of fieldMapping.trim().split('\n').slice(0, 3)) {
        const [name, ...rest] = line.split('=');
        if (name?.trim()) {
          vars.push({ name: name.trim(), detail: rest.join('=').trim() || dataSource || 'Mapped field' });
        }
      }
    }
    vars.push(ZERO_DENOMINATOR_VAR);
    return vars;
  }, [dictEntry, fieldMapping, dataSource]);

  const staleWarn = Number(freshnessHours) > 0 && plan?.qa_status === 'pending';
  const mappingOk = Boolean(fieldMapping.trim());
  const ownerOk = Boolean(ownerName.trim());

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

  const instanceLabel = selected
    ? `${dictionaryLabels[selected.dictionary_id] ?? selected.dictionary_id} · ${selected.source_id}`
    : '';

  return (
    <form className="kpi-hub-skpi-measurement-form" onSubmit={(e) => void handleSave(e)}>
      <SkpiTwoColumnLayout
        main={
          <div className="kpi-hub-skpi-measurement-main">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Measurement Plan — {instanceLabel || 'Chọn instance'}</h2>
                {staleWarn ? (
                  <span className="kpi-hub-badge kpi-hub-badge--amber">Data Quality Warning</span>
                ) : null}
              </header>
              <div className="kpi-hub-card__body kpi-hub-skpi-formgrid">
                <label className="kpi-hub-field">
                  <span>KPI Instance</span>
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
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nguyễn Kiều · Performance MKT"
                  />
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
                  <span>Timezone</span>
                  <select defaultValue="Asia/Ho_Chi_Minh">
                    <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Data Source</span>
                  <input
                    value={dataSource}
                    onChange={(e) => setDataSource(e.target.value)}
                    placeholder="Meta Ads API + CRM Core"
                  />
                </label>
                <label className="kpi-hub-field">
                  <span>Freshness SLA</span>
                  <select value={freshnessHours} onChange={(e) => setFreshnessHours(e.target.value)}>
                    <option value="24">24 giờ</option>
                    <option value="12">12 giờ</option>
                    <option value="48">48 giờ</option>
                  </select>
                </label>
                <label className="kpi-hub-field kpi-hub-field--full">
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
            </article>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Formula snapshot &amp; QA</h2>
              </header>
              <div className="kpi-hub-card__body">
                <SkpiFormulaBlock
                  formula={
                    dictEntry?.formulaDisplay ??
                    (dictEntry?.name
                      ? `${dictEntry.name} = theo mapping và nguồn đã cấu hình`
                      : 'Chọn instance có KPI Definition để xem formula snapshot')
                  }
                  vars={formulaVars}
                />
              </div>
            </article>
          </div>
        }
        aside={
          <div className="kpi-hub-skpi-measurement-aside">
            <article className="kpi-hub-card kpi-hub-skpi-readiness">
              <header className="kpi-hub-card__head">
                <h2>Readiness</h2>
              </header>
              <div className="kpi-hub-card__body">
                <ul className="kpi-hub-skpi-rhythm-list">
                  <li>
                    <span>Definition/formula</span>
                    <b className={dictEntry ? 'is-ok' : ''}>{dictEntry ? '✓ Valid' : 'Pending'}</b>
                  </li>
                  <li>
                    <span>Source mapping</span>
                    <b className={mappingOk ? 'is-ok' : 'is-warn'}>{mappingOk ? '✓ Configured' : '! Missing'}</b>
                  </li>
                  <li>
                    <span>Owner/cadence</span>
                    <b className={ownerOk ? 'is-ok' : 'is-warn'}>{ownerOk ? '✓ Assigned' : '! Pending'}</b>
                  </li>
                  <li>
                    <span>Freshness</span>
                    <b className={staleWarn ? 'is-warn' : 'is-ok'}>
                      {staleWarn ? `! Stale ${freshnessHours}h` : `✓ ${freshnessHours}h SLA`}
                    </b>
                  </li>
                  <li>
                    <span>QA verification</span>
                    <b className={plan?.qa_status === 'pending' ? 'is-warn' : plan ? 'is-ok' : ''}>
                      {plan?.qa_status === 'pending' ? 'Pending' : plan ? 'Draft' : '—'}
                    </b>
                  </li>
                </ul>
              </div>
            </article>
            <Link
              href={`/crm/kpi-hub/tracking${instanceId ? `?instance=${encodeURIComponent(instanceId)}` : ''}`}
              className="kpi-hub-btn kpi-hub-btn--primary kpi-hub-skpi-full-btn"
            >
              Mở Actual Tracking
            </Link>
          </div>
        }
      />
    </form>
  );
}

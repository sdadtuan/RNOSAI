'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PM_SUBTITLES } from '@/lib/performance-copy';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmReadinessRail } from '@/components/kpi-hub/performance/PmReadinessRail';
import { getAccessToken } from '@/lib/auth';
import { activatePmAssignment, createPmAssignment } from '@/lib/performance-api';
import { evaluateAssignmentReadiness, isTargetBandValid } from '@/lib/performance-band';
import { PM_CLIENT_OPTIONS, PM_PROJECT_OPTIONS } from '@/lib/performance-clients';

const DEFINITIONS = {
  MKT_006: {
    name: 'CPL Valid Lead',
    classification: 'OPTIMIZATION_TARGET · inherit',
    formula: 'Ads Spend / COUNT(leads WHERE is_valid AND deduplicated)',
    direction: 'lower',
    directionLabel: 'Lower is better',
  },
  SAL_014: {
    name: 'Qualified Lead',
    classification: 'OUTCOME · inherit',
    formula: 'COUNT(leads WHERE qualified=true)',
    direction: 'higher',
    directionLabel: 'Higher is better',
  },
} as const;

type DefCode = keyof typeof DEFINITIONS;

export default function CreatePerformanceKpiPage() {
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const [definitionCode, setDefinitionCode] = useState<DefCode>('MKT_006');
  const [owner, setOwner] = useState('Lê Hoàng — Performance');
  const [scopeName, setScopeName] = useState('360 AUTO DETAILING');
  const [scopeType, setScopeType] = useState('client');
  const [target, setTarget] = useState('120000');
  const [targetMin, setTargetMin] = useState('100000');
  const [targetStretch, setTargetStretch] = useState('90000');
  const [collectionMethod, setCollectionMethod] = useState('api');
  const [sourceId, setSourceId] = useState('QT-0360');
  const [instanceId, setInstanceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedGates, setBlockedGates] = useState<Array<{ id: string; status: string; detail: string }> | null>(
    null,
  );

  const def = DEFINITIONS[definitionCode];

  const onScopeTypeChange = (next: string) => {
    setScopeType(next);
    if (next === 'client') {
      setScopeName(PM_CLIENT_OPTIONS[0]);
      setSourceId('QT-0360');
    } else if (next === 'campaign') {
      setScopeName('Growth Launch Q4');
      setSourceId('QT-0089');
    } else if (next === 'department') {
      setScopeName('Performance');
      setSourceId('');
    } else if (next === 'project') {
      setScopeName(PM_PROJECT_OPTIONS[0]);
      setSourceId('QT-0089');
    }
  };

  const readiness = useMemo(() => {
    const targetNum = Number(target.replace(/\D/g, '')) || 0;
    const minNum = Number(targetMin.replace(/\D/g, '')) || 0;
    const stretchNum = Number(targetStretch.replace(/\D/g, '')) || 0;
    const bandValid = isTargetBandValid({
      direction: def.direction,
      min: minNum,
      target: targetNum,
      stretch: stretchNum,
    });
    const hasPlan =
      collectionMethod === 'manual' || Boolean(sourceId.trim()) || Boolean(instanceId.trim());
    return evaluateAssignmentReadiness({
      definition_active: true,
      owner_active: Boolean(owner.trim()),
      band_valid: bandValid,
      has_measurement_plan: hasPlan,
      auto_tracked: collectionMethod === 'api' || collectionMethod === 'connector',
      client_visible: false,
      has_disclaimer: false,
    });
  }, [owner, target, targetMin, targetStretch, def.direction, collectionMethod, sourceId, instanceId]);

  const payload = () => ({
    name: `${def.name} · ${scopeName}`,
    definition_code: definitionCode,
    owner: owner.split('—')[0]?.trim() ?? owner,
    scope_type: scopeType,
    scope_name: scopeName,
    target: Number(target.replace(/\D/g, '')) || 0,
    target_min: Number(targetMin.replace(/\D/g, '')) || null,
    target_stretch: Number(targetStretch.replace(/\D/g, '')) || null,
    direction: def.direction,
    collection_method: collectionMethod,
    department: 'Performance',
    source_id: sourceId.trim() || null,
    instance_id: instanceId.trim() || null,
    quoted_target: Number(target.replace(/\D/g, '')) || null,
  });

  const handleDraft = async () => {
    setSaving(true);
    setError(null);
    setBlockedGates(null);
    try {
      const created = await createPmAssignment(token, payload());
      router.push(`/crm/kpi-hub/performance/assignments/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tạo được assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!readiness.can_activate) {
      setBlockedGates(readiness.gates);
      setError('Activate bị chặn: Source mapping chưa pass');
      return;
    }
    setSaving(true);
    setError(null);
    setBlockedGates(null);
    try {
      const created = await createPmAssignment(token, payload());
      await activatePmAssignment(token, created.id);
      router.push('/crm/kpi-hub/performance/assignments');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không activate được';
      if (msg === 'readiness_blocked') {
        setBlockedGates(readiness.gates);
      }
      setError(msg === 'readiness_blocked' ? 'readiness_blocked' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PmPage
      title="Tạo Assignment"
      subtitle={PM_SUBTITLES.create}
      crumb="Tạo Assignment"
      actions={
        <>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled={saving} onClick={() => void handleDraft()}>
            Lưu nháp
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving} onClick={() => void handleActivate()}>
            Submit Activate
          </button>
        </>
      }
    >
      {error ? (
        <p className="kpi-hub-form-error">
          {error === 'readiness_blocked' ? 'Activate bị chặn: readiness_blocked' : error}
        </p>
      ) : null}
      <div className="kpi-hub-pm-layout">
        <div className="kpi-hub-pm-form">
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>1. Metric chuẩn</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>KPI Definition *</span>
                <select value={definitionCode} onChange={(e) => setDefinitionCode(e.target.value as DefCode)}>
                  <option value="MKT_006">MKT_006 — CPL Valid Lead (Active)</option>
                  <option value="SAL_014">SAL_014 — Qualified Lead</option>
                </select>
              </label>
              <label className="kpi-hub-field">
                <span>Classification</span>
                <input value={def.classification} disabled />
              </label>
              <div className="kpi-hub-field kpi-hub-field--full">
                <span>Formula snapshot (read-only)</span>
                <pre className="kpi-hub-pm-formula">{def.formula}</pre>
              </div>
            </div>
          </article>
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>2. Scope &amp; owner</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>Scope</span>
                <select value={scopeType} onChange={(e) => onScopeTypeChange(e.target.value)}>
                  <option value="campaign">Campaign</option>
                  <option value="client">Client</option>
                  <option value="project">Project</option>
                  <option value="department">Department</option>
                </select>
              </label>
              {scopeType === 'client' ? (
                <label className="kpi-hub-field">
                  <span>Client *</span>
                  <select
                    aria-label="Chọn Client"
                    value={scopeName}
                    onChange={(e) => setScopeName(e.target.value)}
                  >
                    {PM_CLIENT_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {scopeType === 'project' ? (
                <label className="kpi-hub-field">
                  <span>Project *</span>
                  <select
                    aria-label="Chọn Project"
                    value={scopeName}
                    onChange={(e) => setScopeName(e.target.value)}
                  >
                    {PM_PROJECT_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {scopeType === 'campaign' ? (
                <label className="kpi-hub-field">
                  <span>Campaign *</span>
                  <input
                    aria-label="Tên Campaign"
                    value={scopeName}
                    onChange={(e) => setScopeName(e.target.value)}
                  />
                </label>
              ) : null}
              {scopeType === 'department' ? (
                <label className="kpi-hub-field">
                  <span>Department *</span>
                  <select value={scopeName} onChange={(e) => setScopeName(e.target.value)}>
                    <option>Performance</option>
                    <option>Sales</option>
                    <option>Marketing</option>
                    <option>Technology</option>
                  </select>
                </label>
              ) : null}
              <label className="kpi-hub-field">
                <span>Owner *</span>
                <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option>Lê Hoàng — Performance</option>
                  <option>Nguyễn Minh Anh — Sales</option>
                </select>
              </label>
              <label className="kpi-hub-field">
                <span>Collection method</span>
                <select value={collectionMethod} onChange={(e) => setCollectionMethod(e.target.value)}>
                  <option value="api">API (auto-tracked)</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="kpi-hub-field">
                <span>Quote / Source ID</span>
                <input
                  aria-label="Source ID"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  placeholder="QT-0360"
                />
              </label>
              <label className="kpi-hub-field">
                <span>KPI Instance ID</span>
                <input
                  aria-label="Instance ID"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="sau khi seed QT-0360"
                />
              </label>
            </div>
          </article>
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>3. Target band</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>Direction</span>
                <input value={def.directionLabel} disabled />
              </label>
              <label className="kpi-hub-field">
                <span>Target *</span>
                <input value={target} onChange={(e) => setTarget(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Minimum (mid-band)</span>
                <input value={targetMin} onChange={(e) => setTargetMin(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Stretch (best)</span>
                <input value={targetStretch} onChange={(e) => setTargetStretch(e.target.value)} />
              </label>
            </div>
            <PmAmberNotice>
              Lower-is-better: stretch ≤ minimum ≤ target (vd. 90K ≤ 100K ≤ 120K cho QT-0360).
            </PmAmberNotice>
          </article>
        </div>
        <aside className="kpi-hub-pm-aside">
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>Readiness gate</h2>
            </header>
            <div className="kpi-hub-card__body">
              <PmReadinessRail gates={blockedGates ?? readiness.gates} />
              <PmAmberNotice>
                Activate cần Source ID / Instance (Measurement Plan) + band hợp lệ — không tạo KPI mồ côi.
              </PmAmberNotice>
            </div>
          </article>
        </aside>
      </div>
    </PmPage>
  );
}

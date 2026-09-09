'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmReadinessRail } from '@/components/kpi-hub/performance/PmReadinessRail';
import { getAccessToken } from '@/lib/auth';
import { activatePmAssignment, createPmAssignment } from '@/lib/performance-api';

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

function evaluateReadiness(input: {
  definition_active: boolean;
  owner_active: boolean;
  band_valid: boolean;
  has_measurement_plan: boolean;
  auto_tracked: boolean;
  client_visible: boolean;
  has_disclaimer: boolean;
}) {
  const gates = [
    { id: 'definition', status: input.definition_active ? 'pass' : 'fail', detail: 'Definition Active' },
    { id: 'owner', status: input.owner_active ? 'pass' : 'fail', detail: 'Owner active' },
    { id: 'band', status: input.band_valid ? 'pass' : 'fail', detail: 'Direction / band' },
    {
      id: 'source',
      status: !input.auto_tracked || input.has_measurement_plan ? 'pass' : 'pending',
      detail: 'Measurement Plan',
    },
    {
      id: 'visibility',
      status: !input.client_visible || input.has_disclaimer ? 'pass' : 'fail',
      detail: 'Client disclaimer',
    },
  ];
  return { gates, can_activate: gates.every((g) => g.status === 'pass') };
}

export default function CreatePerformanceKpiPage() {
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const [definitionCode, setDefinitionCode] = useState<DefCode>('MKT_006');
  const [owner, setOwner] = useState('Lê Hoàng — Performance');
  const [scopeName, setScopeName] = useState('Growth Launch Q4');
  const [scopeType, setScopeType] = useState('campaign');
  const [target, setTarget] = useState('100000');
  const [targetMin, setTargetMin] = useState('85000');
  const [targetStretch, setTargetStretch] = useState('70000');
  const [collectionMethod, setCollectionMethod] = useState('api');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedGates, setBlockedGates] = useState<Array<{ id: string; status: string; detail: string }> | null>(
    null,
  );

  const def = DEFINITIONS[definitionCode];

  const readiness = useMemo(() => {
    const targetNum = Number(target.replace(/\D/g, '')) || 0;
    const minNum = Number(targetMin.replace(/\D/g, '')) || 0;
    const stretchNum = Number(targetStretch.replace(/\D/g, '')) || 0;
    const bandValid =
      def.direction === 'lower'
        ? stretchNum <= targetNum && targetNum <= minNum
        : minNum <= targetNum && targetNum <= stretchNum;
    return evaluateReadiness({
      definition_active: true,
      owner_active: Boolean(owner.trim()),
      band_valid: bandValid,
      has_measurement_plan: collectionMethod === 'manual',
      auto_tracked: collectionMethod === 'api' || collectionMethod === 'connector',
      client_visible: false,
      has_disclaimer: false,
    });
  }, [owner, target, targetMin, targetStretch, def.direction, collectionMethod]);

  const handleDraft = async () => {
    setSaving(true);
    setError(null);
    setBlockedGates(null);
    try {
      await createPmAssignment(token, {
        name: def.name,
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
      });
      router.push('/crm/kpi-hub/performance/assignments');
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
      const created = await createPmAssignment(token, {
        name: def.name,
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
      });
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
      subtitle="PM-03 · Prefill Dictionary Active. Custom KPI cần approval. Activate bị chặn nếu readiness đỏ."
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
              <label className="kpi-hub-field kpi-hub-field--full">
                <span>Formula snapshot (read-only)</span>
                <input value={def.formula} disabled />
              </label>
            </div>
          </article>
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>2. Scope &amp; owner</h2>
            </header>
            <div className="kpi-hub-card__body kpi-hub-pm-fields">
              <label className="kpi-hub-field">
                <span>Scope</span>
                <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
                  <option value="campaign">Campaign · {scopeName}</option>
                  <option value="client">Client</option>
                  <option value="department">Department</option>
                </select>
              </label>
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
                <span>Minimum</span>
                <input value={targetMin} onChange={(e) => setTargetMin(e.target.value)} />
              </label>
              <label className="kpi-hub-field">
                <span>Stretch</span>
                <input value={targetStretch} onChange={(e) => setTargetStretch(e.target.value)} />
              </label>
            </div>
            <PmAmberNotice>
              Target 100K = Quoted QT-0089. Đổi xuống 85K → material variance → Change Order + Contract Score.
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
                Activate block cho đến khi Source mapping pass — không tạo KPI “mồ côi” như HubSpot Goals.
              </PmAmberNotice>
            </div>
          </article>
        </aside>
      </div>
    </PmPage>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PM_SUBTITLES } from '@/lib/performance-copy';
import { PmPage } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmReadinessRail } from '@/components/kpi-hub/performance/PmReadinessRail';
import { getAccessToken } from '@/lib/auth';
import {
  activatePmAssignment,
  fetchPmAssignment,
  updatePmAssignment,
} from '@/lib/performance-api';
import { evaluateAssignmentReadiness, isTargetBandValid } from '@/lib/performance-band';
import { PM_CLIENT_OPTIONS, PM_PROJECT_OPTIONS } from '@/lib/performance-clients';
import type { PmAssignment } from '@/lib/performance-types';

export default function EditPerformanceAssignmentPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const router = useRouter();
  const token = getAccessToken() ?? '';

  const [row, setRow] = useState<PmAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockedGates, setBlockedGates] = useState<Array<{ id: string; status: string; detail: string }> | null>(
    null,
  );

  const [owner, setOwner] = useState('');
  const [scopeName, setScopeName] = useState('');
  const [scopeType, setScopeType] = useState('client');
  const [target, setTarget] = useState('');
  const [targetMin, setTargetMin] = useState('');
  const [targetStretch, setTargetStretch] = useState('');
  const [collectionMethod, setCollectionMethod] = useState('api');
  const [sourceId, setSourceId] = useState('');
  const [instanceId, setInstanceId] = useState('');

  useEffect(() => {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    void fetchPmAssignment(token, id)
      .then((asg) => {
        setRow(asg);
        setOwner(asg.owner);
        setScopeName(asg.scope_name);
        setScopeType(asg.scope_type);
        setTarget(String(asg.target ?? ''));
        setTargetMin(asg.target_min != null ? String(asg.target_min) : '');
        setTargetStretch(asg.target_stretch != null ? String(asg.target_stretch) : '');
        setCollectionMethod(asg.collection_method || 'api');
        setSourceId(asg.source_id ?? '');
        setInstanceId(asg.instance_id ?? '');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải assignment'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const direction = row?.direction ?? 'lower';

  const readiness = useMemo(() => {
    const targetNum = Number(String(target).replace(/\D/g, '')) || 0;
    const minNum = Number(String(targetMin).replace(/\D/g, '')) || 0;
    const stretchNum = Number(String(targetStretch).replace(/\D/g, '')) || 0;
    const bandValid = isTargetBandValid({
      direction,
      min: minNum,
      target: targetNum,
      stretch: stretchNum,
    });
    const hasPlan =
      collectionMethod === 'manual' || Boolean(sourceId.trim()) || Boolean(instanceId.trim());
    return evaluateAssignmentReadiness({
      definition_active: Boolean(row?.definition_code && row.definition_code !== 'CUSTOM'),
      owner_active: Boolean(owner.trim()),
      band_valid: bandValid,
      has_measurement_plan: hasPlan,
      auto_tracked: collectionMethod === 'api' || collectionMethod === 'connector',
      client_visible: Boolean(row?.client_visible),
      has_disclaimer: Boolean(row?.disclaimer?.trim()),
    });
  }, [
    row,
    owner,
    target,
    targetMin,
    targetStretch,
    direction,
    collectionMethod,
    sourceId,
    instanceId,
  ]);

  const patchBody = () => ({
    owner: owner.split('—')[0]?.trim() ?? owner,
    scope_type: scopeType,
    scope_name: scopeName,
    target: Number(String(target).replace(/\D/g, '')) || 0,
    target_min: Number(String(targetMin).replace(/\D/g, '')) || null,
    target_stretch: Number(String(targetStretch).replace(/\D/g, '')) || null,
    collection_method: collectionMethod,
    source_id: sourceId.trim() || null,
    instance_id: instanceId.trim() || null,
  });

  const handleSave = async () => {
    if (!row || row.lifecycle !== 'draft') return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePmAssignment(token, row.id, patchBody());
      setRow(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!row) return;
    if (!readiness.can_activate) {
      setBlockedGates(readiness.gates);
      setError('Activate bị chặn: Source mapping chưa pass');
      return;
    }
    setSaving(true);
    setError(null);
    setBlockedGates(null);
    try {
      if (row.lifecycle === 'draft') {
        await updatePmAssignment(token, row.id, patchBody());
      }
      await activatePmAssignment(token, row.id);
      router.push('/crm/kpi-hub/performance/assignments');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không activate được';
      if (msg === 'readiness_blocked') setBlockedGates(readiness.gates);
      setError(msg === 'readiness_blocked' ? 'readiness_blocked' : msg);
    } finally {
      setSaving(false);
    }
  };

  const editable = row?.lifecycle === 'draft';

  return (
    <PmPage
      title={row ? `Sửa: ${row.name}` : 'Sửa Assignment'}
      subtitle={PM_SUBTITLES.create}
      crumb={row?.scope_name ?? 'Assignment'}
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/assignments" className="kpi-hub-btn kpi-hub-btn--ghost">
            Registry
          </Link>
          {editable ? (
            <>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" disabled={saving} onClick={() => void handleSave()}>
                Lưu nháp
              </button>
              <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled={saving} onClick={() => void handleActivate()}>
                Submit Activate
              </button>
            </>
          ) : null}
        </>
      }
    >
      <PmPageState loading={loading} error={error && !row ? error : null} empty={false} />
      {error && row ? <p className="kpi-hub-form-error">{error === 'readiness_blocked' ? 'Activate bị chặn: readiness_blocked' : error}</p> : null}
      {row ? (
        <div className="kpi-hub-pm-layout">
          <div className="kpi-hub-pm-form">
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>1. Metric chuẩn</h2>
              </header>
              <div className="kpi-hub-card__body kpi-hub-pm-fields">
                <label className="kpi-hub-field">
                  <span>KPI Definition</span>
                  <input value={`${row.definition_code} — ${row.name}`} disabled />
                </label>
                <label className="kpi-hub-field">
                  <span>Lifecycle</span>
                  <input value={row.lifecycle} disabled />
                </label>
                <label className="kpi-hub-field">
                  <span>Code</span>
                  <input value={row.code} disabled />
                </label>
              </div>
            </article>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>2. Scope &amp; mapping</h2>
              </header>
              <div className="kpi-hub-card__body kpi-hub-pm-fields">
                <label className="kpi-hub-field">
                  <span>Scope</span>
                  <select value={scopeType} disabled={!editable} onChange={(e) => setScopeType(e.target.value)}>
                    <option value="campaign">Campaign</option>
                    <option value="client">Client</option>
                    <option value="project">Project</option>
                    <option value="department">Department</option>
                  </select>
                </label>
                {scopeType === 'client' ? (
                  <label className="kpi-hub-field">
                    <span>Client *</span>
                    <select value={scopeName} disabled={!editable} onChange={(e) => setScopeName(e.target.value)}>
                      {PM_CLIENT_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!PM_CLIENT_OPTIONS.includes(scopeName as (typeof PM_CLIENT_OPTIONS)[number]) ? (
                        <option value={scopeName}>{scopeName}</option>
                      ) : null}
                    </select>
                  </label>
                ) : (
                  <label className="kpi-hub-field">
                    <span>Scope name *</span>
                    <input value={scopeName} disabled={!editable} onChange={(e) => setScopeName(e.target.value)} list="pm-scope-opts" />
                    <datalist id="pm-scope-opts">
                      {[...PM_CLIENT_OPTIONS, ...PM_PROJECT_OPTIONS].map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  </label>
                )}
                <label className="kpi-hub-field">
                  <span>Owner *</span>
                  <input value={owner} disabled={!editable} onChange={(e) => setOwner(e.target.value)} />
                </label>
                <label className="kpi-hub-field">
                  <span>Collection method</span>
                  <select
                    value={collectionMethod}
                    disabled={!editable}
                    onChange={(e) => setCollectionMethod(e.target.value)}
                  >
                    <option value="api">API (auto-tracked)</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="kpi-hub-field">
                  <span>Quote / Source ID</span>
                  <input value={sourceId} disabled={!editable} onChange={(e) => setSourceId(e.target.value)} />
                </label>
                <label className="kpi-hub-field">
                  <span>KPI Instance ID</span>
                  <input value={instanceId} disabled={!editable} onChange={(e) => setInstanceId(e.target.value)} />
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
                  <input value={direction === 'lower' ? 'Lower is better' : 'Higher is better'} disabled />
                </label>
                <label className="kpi-hub-field">
                  <span>Target *</span>
                  <input value={target} disabled={!editable} onChange={(e) => setTarget(e.target.value)} />
                </label>
                <label className="kpi-hub-field">
                  <span>Minimum (mid-band)</span>
                  <input value={targetMin} disabled={!editable} onChange={(e) => setTargetMin(e.target.value)} />
                </label>
                <label className="kpi-hub-field">
                  <span>Stretch (best)</span>
                  <input value={targetStretch} disabled={!editable} onChange={(e) => setTargetStretch(e.target.value)} />
                </label>
              </div>
              <PmAmberNotice>
                Lower-is-better: stretch ≤ minimum ≤ target. Source QT-0360 gắn Measurement Plan cho Activate.
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
                {!editable ? (
                  <PmAmberNotice>Assignment không còn nháp — chỉ xem.</PmAmberNotice>
                ) : (
                  <PmAmberNotice>
                    Seed Instance QT-0360 tại KPI Instances rồi gắn Source/Instance trước Activate.
                  </PmAmberNotice>
                )}
              </div>
            </article>
          </aside>
        </div>
      ) : null}
    </PmPage>
  );
}

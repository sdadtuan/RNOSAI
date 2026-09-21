'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchServiceLifecycleConsultBrief,
  fetchServiceLifecycleMarketingPlan,
  patchServiceLifecycleMarketingPlan,
  postPresalesGeneratePlanReview,
  postServiceLifecycleMarketingPlanPrefillFromConsult,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { STRATEGY_LABELS, TMMT_PROF_LABELS } from '@/lib/tmmt-labels';
import { PresalesAssumedConfirmBar, needsAssumedConfirm } from '@/components/PresalesAssumedConfirmBar';

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
  stage: string;
  onSaved?: () => void;
  onOpenAiPlannerTab?: () => void;
}

type MarketingPlanPayload = {
  plan: {
    id?: number;
    name?: string;
    north_star?: string;
    objectives?: string;
    strategy_framework?: Record<string, string>;
    target_market_prof?: Record<string, string>;
  } | null;
  validation: { ok: boolean; messages: string[] };
  tmmt_core_keys?: string[];
  tmmt_prof_keys?: string[];
  tmmt_min_filled?: number;
  filled_count?: number;
};

type TmmtCoreKey =
  | 'market_context'
  | 'segmentation_icp'
  | 'personas_roles'
  | 'pains_desired_outcomes';

function parseTmmtFieldMeta(
  strategyFramework: Record<string, string> | undefined,
): Partial<Record<TmmtCoreKey, { status?: string; text?: string; ai_draft?: boolean; source?: string }>> {
  const raw = strategyFramework?.ai_tmmt_field_meta;
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Partial<
      Record<TmmtCoreKey, { status?: string; text?: string; ai_draft?: boolean; source?: string }>
    >;
  } catch {
    return {};
  }
}

export function LifecycleTmmtPanel({ token, user, lifecycleId, stage, onSaved, onOpenAiPlannerTab }: Props) {
  const router = useRouter();
  const [data, setData] = useState<MarketingPlanPayload | null>(null);
  const [draftSf, setDraftSf] = useState<Record<string, string>>({});
  const [draftProf, setDraftProf] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [planReviewBusy, setPlanReviewBusy] = useState(false);
  const [overwritePrefill, setOverwritePrefill] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [p8Quality, setP8Quality] = useState<{
    need_pain?: { status?: string; text?: string } | null;
    icp?: { status?: string; text?: string } | null;
    service_status?: string;
  } | null>(null);

  const canEdit = hasCap(user, 'crm_board', 'edit');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [out, brief] = await Promise.all([
        fetchServiceLifecycleMarketingPlan(token, lifecycleId),
        fetchServiceLifecycleConsultBrief(token, lifecycleId).catch(() => null),
      ]);
      setData(out as MarketingPlanPayload);
      const plan = (out as MarketingPlanPayload).plan;
      setDraftSf(plan?.strategy_framework ?? {});
      setDraftProf(plan?.target_market_prof ?? {});
      const q = (brief as { p8_quality?: typeof p8Quality } | null)?.p8_quality ?? null;
      setP8Quality(q);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải TMMT thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const out = await patchServiceLifecycleMarketingPlan(token, lifecycleId, {
        target_market_prof: draftProf,
        strategy_framework: draftSf,
      });
      setData(out as MarketingPlanPayload);
      setMessage('Đã lưu TMMT chính thức');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu TMMT thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function prefillFromConsult() {
    if (!canEdit) return;
    setPrefillBusy(true);
    setMessage('');
    setError('');
    try {
      const out = await postServiceLifecycleMarketingPlanPrefillFromConsult(token, lifecycleId, {
        overwrite: overwritePrefill,
      });
      setData(out as MarketingPlanPayload);
      const plan = (out as MarketingPlanPayload).plan;
      setDraftSf(plan?.strategy_framework ?? {});
      setDraftProf(plan?.target_market_prof ?? {});
      const n = out.filled_keys?.length ?? 0;
      setMessage(
        n > 0
          ? `Prefill Consult/Intake: ${n} field · tiến độ ${out.filled_count ?? 0}/12`
          : 'Không có field mới từ Consult/Intake (đã đủ hoặc thiếu nguồn).',
      );
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prefill TMMT thất bại');
    } finally {
      setPrefillBusy(false);
    }
  }

  async function generatePlanReview() {
    if (!canEdit || planReviewBusy) return;
    const ok = window.confirm(
      'Tạo Marketing Plan status=review từ presales. CEO duyệt mới active. Tiếp tục?',
    );
    if (!ok) return;
    setPlanReviewBusy(true);
    setError('');
    setMessage('');
    try {
      const cloneFrom = data?.plan?.id != null ? Number(data.plan.id) : undefined;
      const out = await postPresalesGeneratePlanReview(token, lifecycleId, {
        clone_from_plan_id: Number.isFinite(cloneFrom) ? cloneFrom : undefined,
      });
      const blockers = out.gate_snapshot?.blockers?.map((b) => b.code).join(', ') || 'none';
      setMessage(`Plan #${out.plan_id} status=review · blockers: ${blockers}`);
      router.push(`/crm/marketing-plan/${out.plan_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinh plan review thất bại');
    } finally {
      setPlanReviewBusy(false);
    }
  }

  const validation = data?.validation ?? { ok: false, messages: [] };
  const filled = data?.filled_count ?? 0;
  const minFilled = data?.tmmt_min_filled ?? 6;
  const totalProf = data?.tmmt_prof_keys?.length ?? 12;
  const coreKeys = new Set(data?.tmmt_core_keys ?? []);
  const showEmptyBridgeHint = filled === 0 && Boolean(data?.plan);
  const tmmtCoreMeta = parseTmmtFieldMeta(data?.plan?.strategy_framework);
  const tmmtCoreText: Partial<Record<TmmtCoreKey, string>> = {
    market_context: draftProf.market_context,
    segmentation_icp: draftProf.segmentation_icp,
    personas_roles: draftProf.personas_roles,
    pains_desired_outcomes: draftProf.pains_desired_outcomes,
  };

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>TMMT chính thức (R5)</h3>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Winning gate: TMMT ≥ {minFilled}/{totalProf} + đủ 4 core + geo + Insight approved
          </p>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Consult gate không dùng TMMT≥9 — chỉ BANT≥24 + Pain/Service confirmed + Go.
          </p>
        </div>
        {validation.ok ? (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Gate ✓ — có thể chuyển Deliver</span>
        ) : (
          <span className="error" style={{ fontWeight: 600 }}>Gate chưa pass</span>
        )}
      </div>

      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      <PresalesAssumedConfirmBar
        token={token}
        lifecycleId={lifecycleId}
        canEdit={canEdit}
        canConfirmAssumed={canEdit}
        needPain={p8Quality?.need_pain}
        icp={p8Quality?.icp}
        serviceStatus={p8Quality?.service_status}
        tmmtCoreMeta={tmmtCoreMeta}
        tmmtCoreText={tmmtCoreText}
        compact
        onDone={() => void reload()}
      />

      {showEmptyBridgeHint ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Plan đang trống (0/{totalProf}). Dùng <strong>Prefill từ Consult/Intake</strong> để seed từ BANT Go,
          hoặc mở AI Planner để generate rồi Apply.
        </p>
      ) : null}

      {canEdit ? (
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={overwritePrefill}
              onChange={(e) => setOverwritePrefill(e.target.checked)}
            />
            Ghi đè field đã có
          </label>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={prefillBusy || !data?.plan}
            onClick={() => void prefillFromConsult()}
          >
            {prefillBusy ? 'Đang prefill…' : 'Prefill từ Consult/Intake'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={planReviewBusy}
            onClick={() => void generatePlanReview()}
          >
            {planReviewBusy ? 'Đang sinh…' : 'Sinh plan review'}
          </button>
          {onOpenAiPlannerTab ? (
            <button type="button" className="btn btn-sm" onClick={onOpenAiPlannerTab}>
              Mở AI Planner
            </button>
          ) : null}
        </div>
      ) : null}

      {!validation.ok ? (
        <ul className="error" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {validation.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      {stage === 'onboard' && !validation.ok ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Hoàn thiện TMMT trước khi bấm <strong>Chuyển → Triển khai</strong> trên tab Workflow.
          {onOpenAiPlannerTab ? (
            <>
              {' '}
              Hoặc dùng{' '}
              <button type="button" className="btn btn-sm btn-ghost" onClick={onOpenAiPlannerTab}>
                AI Planner →
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {!data?.plan ? (
        <p className="error">Chưa có kế hoạch MKT chính thức — kiểm tra promote từ presales.</p>
      ) : (
        <>
          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Khung chiến lược</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted">{label}</span>
                  <textarea
                    rows={key === 'target_market' ? 2 : 2}
                    value={draftSf[key] ?? ''}
                    disabled={!canEdit || saving}
                    onChange={(e) => setDraftSf((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.55rem 0.75rem',
                      color: 'var(--text)',
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Thuyết minh thị trường mục tiêu</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {(data.tmmt_prof_keys ?? Object.keys(TMMT_PROF_LABELS)).map((key) => {
                const coreKey = key as TmmtCoreKey;
                const assumed = needsAssumedConfirm(tmmtCoreMeta[coreKey], draftProf[key]);
                return (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted">
                    {TMMT_PROF_LABELS[key] ?? key}
                    {coreKeys.has(key) ? ' *' : ''}
                    {assumed ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--accent, #2a7)',
                        }}
                      >
                        · assumed — Confirm Assumed ở trên
                      </span>
                    ) : null}
                  </span>
                  <textarea
                    rows={2}
                    value={draftProf[key] ?? ''}
                    disabled={!canEdit || saving}
                    onChange={(e) => setDraftProf((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      background: 'var(--bg)',
                      border: coreKeys.has(key) && !String(draftProf[key] ?? '').trim() ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.55rem 0.75rem',
                      color: 'var(--text)',
                    }}
                  />
                </label>
                );
              })}
            </div>
          </section>

          {canEdit ? (
            <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void save()}>
              Lưu TMMT
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

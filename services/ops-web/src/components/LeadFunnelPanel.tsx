'use client';

import { PresalesTaskFormCard } from '@/components/PresalesTaskFormCard';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  advanceLeadPresales,
  completeLeadCareStage,
  ensureLeadPresales,
  fetchLeadFunnel,
  fetchLeadPresalesConsultGate,
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  patchLeadPresalesTask,
  releaseLeadReviewQueue,
  submitLeadCareReport,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

const STRATEGY_LABELS: Record<string, string> = {
  target_market: 'Thị trường mục tiêu',
  market_message: 'Thông điệp thị trường',
  media_reach: 'Kênh tiếp cận / Media',
  conversion_strategy: 'Chiến lược chuyển đổi',
  retention_system: 'Hệ thống giữ chân',
  nurture_system: 'Nuôi dưỡng lead',
  world_class_experience: 'Trải nghiệm đẳng cấp',
  lifecycle_extension: 'Gia hạn lifecycle',
  referral_engine: 'Giới thiệu / Referral',
};

interface ConsultGateState {
  ok: boolean;
  level: string;
  messages: string[];
  requires_confirm: boolean;
  requires_override: boolean;
  bant_total?: number;
  decision?: string;
}

const FUNNEL_STEPS = [
  { key: 'b2', label: 'B2 Liên hệ' },
  { key: 'lead', label: 'Pre-sales Lead' },
  { key: 'consult', label: 'Tư vấn' },
  { key: 'proposal', label: 'Báo giá' },
] as const;

const DEFAULT_PRESALES_SLUG = 'dich-vu-seo-tong-the';

const DEFAULT_PRESALES_SERVICES: Array<{ slug: string; name: string }> = [
  { slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' },
  { slug: 'dich-vu-seo-local', name: 'SEO Local' },
  { slug: 'dich-vu-seo-audit', name: 'SEO Audit' },
  { slug: 'dich-vu-aeo', name: 'AEO' },
];

export function mergePresalesServiceOptions(
  catalog?: Array<{ slug: string; name: string }>,
): Array<{ slug: string; name: string }> {
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const item of DEFAULT_PRESALES_SERVICES) {
    bySlug.set(item.slug, item);
  }
  for (const item of catalog ?? []) {
    const slug = String(item.slug ?? '').trim();
    if (!slug) continue;
    bySlug.set(slug, { slug, name: String(item.name ?? slug).trim() || slug });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  serviceSlug?: string;
  serviceOptions?: Array<{ slug: string; name: string }>;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onFunnelUpdated?: () => void;
}

export function LeadFunnelPanel({
  token,
  leadId,
  user,
  serviceSlug,
  serviceOptions,
  onMessage,
  onError,
  onFunnelChange,
  onFunnelUpdated,
}: Props) {
  const [funnel, setFunnel] = useState<LeadFunnelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [careNote, setCareNote] = useState('');
  const [careReport, setCareReport] = useState('Đã liên hệ KH — xác nhận nhu cầu');
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelMessage, setPanelMessage] = useState('');
  const [planName, setPlanName] = useState('');
  const [planNorthStar, setPlanNorthStar] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planStrategy, setPlanStrategy] = useState<Record<string, string>>({});
  const [planValidation, setPlanValidation] = useState<string[]>([]);
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<number, Record<string, string>>>({});
  const presalesServiceOptions = useMemo(
    () => mergePresalesServiceOptions(serviceOptions),
    [serviceOptions],
  );
  const [selectedServiceSlug, setSelectedServiceSlug] = useState(
    () => serviceSlug?.trim() || DEFAULT_PRESALES_SLUG,
  );

  useEffect(() => {
    if (serviceSlug?.trim()) {
      setSelectedServiceSlug(serviceSlug.trim());
    }
  }, [serviceSlug]);

  useEffect(() => {
    if (serviceSlug?.trim()) return;
    if (presalesServiceOptions.some((item) => item.slug === selectedServiceSlug)) return;
    setSelectedServiceSlug(presalesServiceOptions[0]?.slug ?? DEFAULT_PRESALES_SLUG);
  }, [presalesServiceOptions, selectedServiceSlug, serviceSlug]);

  const reload = useCallback(async () => {
    setLoading(true);
    setPanelError('');
    try {
      const snap = await fetchLeadFunnel(token, leadId);
      setFunnel(snap);
      onFunnelChange?.(snap);
      if (snap.presales) {
        if (snap.presales.presales.stage === 'lead') {
          try {
            const cg = await fetchLeadPresalesConsultGate(token, leadId);
            setConsultGate(cg.gate);
          } catch {
            setConsultGate(null);
          }
        } else {
          setConsultGate(null);
        }
        if (snap.presales.presales.stage === 'proposal') {
          try {
            const mp = await fetchLeadPresalesMarketingPlan(token, leadId);
            setPlanName(String(mp.plan.name ?? ''));
            setPlanNorthStar(String(mp.plan.north_star ?? ''));
            setPlanObjectives(String(mp.plan.objectives ?? ''));
            let sf: Record<string, string> = {};
            try {
              sf = JSON.parse(String(mp.plan.strategy_framework_json ?? '{}')) as Record<string, string>;
            } catch {
              sf = {};
            }
            setPlanStrategy(sf);
            setPlanValidation(mp.validation.messages ?? []);
          } catch {
            setPlanValidation([]);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải funnel thất bại';
      setPanelError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, onError, onFunnelChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canEdit = Boolean(user && hasCap(user, 'crm_leads', 'edit'));
  const canAssign = Boolean(user && hasCap(user, 'crm_leads', 'assign'));

  async function run(action: () => Promise<void>, refreshContract = false) {
    setBusy(true);
    setPanelError('');
    try {
      await action();
      if (refreshContract) onFunnelUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setPanelError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function finishB2Stage() {
    const note = careNote.trim();
    if (note.length < 3) {
      setPanelError('Ghi chú hoàn thành B2 cần ≥ 3 ký tự.');
      return;
    }
    await run(async () => {
      const reportContent = careReport.trim() || 'Đã liên hệ KH — xác nhận nhu cầu';
      await submitLeadCareReport(token, leadId, { content: reportContent });
      const out = await completeLeadCareStage(token, leadId, note);
      setFunnel(out.funnel);
      onFunnelChange?.(out.funnel);
      setCareNote('');
      const spaDone = out.funnel.lead_flow_kind === 'spa_operational';
      setPanelMessage(spaDone ? 'Đã hoàn thành B2' : 'Đã hoàn thành B2 — pre-sales đã mở.');
      onMessage?.('Đã hoàn thành B2');
      await reload();
    }, true);
  }

  const intakeHref = `/crm/intake?lead_id=${leadId}${
    funnel?.presales?.presales.service_slug
      ? `&service_slug=${encodeURIComponent(funnel.presales.presales.service_slug)}`
      : selectedServiceSlug
        ? `&service_slug=${encodeURIComponent(selectedServiceSlug)}`
        : ''
  }`;

  function activeStepKey(): string {
    if (!funnel) return 'b2';
    if (!funnel.care_pipeline.all_complete) return 'b2';
    if (!funnel.presales) return 'lead';
    return funnel.presales.presales.stage;
  }

  if (loading && !funnel) {
    return <p className="muted">Đang tải funnel B2 / pre-sales…</p>;
  }
  if (!funnel) return null;

  const flowKind = funnel.lead_flow_kind ?? 'b2b_prospect';
  const isSpaFlow = flowKind === 'spa_operational';
  const showPresales = showPresalesForFlow(flowKind);
  const funnelSteps = showPresales ? FUNNEL_STEPS : FUNNEL_STEPS.filter((step) => step.key === 'b2');
  const panelTitle = isSpaFlow ? 'Funnel CSKH Spa — B2 Liên hệ' : 'Funnel B2 → Pre-sales';

  const b2Stage = funnel.care_pipeline.stages[0];
  const inReview = funnel.review_queue.active;
  const activeStep = activeStepKey();
  const b2ContactOkReported = Boolean(funnel.care_pipeline.contact_ok_reported);
  const canCompleteB2 = b2ContactOkReported && careNote.trim().length >= 3;

  return (
    <section className="card stack-gap lead-funnel-panel" id="lead-funnel-panel" style={{ marginTop: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{panelTitle}</h2>

      {panelError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {panelError}
        </div>
      ) : null}
      {panelMessage ? (
        <div className="lead-alert lead-alert--success" role="status">
          {panelMessage}
        </div>
      ) : null}

      <div className="funnel-stepper" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {funnelSteps.map((step, idx) => {
          const presalesIdx = funnel.presales
            ? FUNNEL_STEPS.findIndex((s) => s.key === funnel.presales!.presales.stage)
            : -1;
          const done =
            step.key === 'b2'
              ? funnel.care_pipeline.all_complete
              : presalesIdx >= idx;
          const current = step.key === activeStep;
          return (
            <span
              key={step.key}
              className={`badge${current ? ' badge-active' : ''}`}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: 999,
                fontSize: '0.8rem',
                background: current ? '#1d4ed8' : done ? '#dcfce7' : '#f3f4f6',
                color: current ? '#fff' : done ? '#166534' : '#374151',
              }}
            >
              {step.label}
            </span>
          );
        })}
      </div>

      {inReview && (
        <div className="banner banner-warn">
          <strong>Phải tra soát (GDKD)</strong>
          <p style={{ margin: '0.35rem 0 0' }}>
            {funnel.review_queue.message}
            {funnel.review_queue.hours_waiting != null
              ? ` · đã chờ ${funnel.review_queue.hours_waiting}h`
              : ''}
          </p>
          {canAssign ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
              <Link href="/crm/leads/review-queue" className="nav-link">
                Mở inbox Phải tra soát →
              </Link>
            </p>
          ) : null}
          {canAssign && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              style={{ marginTop: '0.5rem' }}
              onClick={() =>
                void run(async () => {
                  await releaseLeadReviewQueue(token, leadId, { mode: 'auto', note: 'Release từ ops-web' });
                  onMessage?.('Đã release lead khỏi review queue');
                  await reload();
                })
              }
            >
              Release (auto gán lại AM)
            </button>
          )}
        </div>
      )}

      <div className="card-inner" id="funnel-b2">
        <h3 style={{ marginTop: 0 }}>B2 — {b2Stage?.label ?? 'Liên hệ lần đầu'}</h3>
        <p className="muted" style={{ fontSize: '0.9rem' }}>{b2Stage?.hint}</p>
        <p>
          {showPresales ? (
            <>
              Gate pre-sales:{' '}
              <strong>{funnel.presales_care_gate.complete ? '✓ Mở' : '🔒 Chưa hoàn thành B2'}</strong>
            </>
          ) : (
            <>
              Luồng spa: hoàn thành B2 rồi chốt trạng thái lead (không Pre-sales).
            </>
          )}
          {!funnel.care_pipeline.all_complete && canEdit && !inReview ? (
            <span className="muted" style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Bước 1 — Liên hệ OK:{' '}
              <strong style={{ color: b2ContactOkReported ? '#15803d' : '#b45309' }}>
                {b2ContactOkReported ? '✓ Đã gửi báo cáo' : 'Chưa gửi'}
              </strong>
            </span>
          ) : null}
        </p>
        {!funnel.care_pipeline.all_complete && canEdit && !inReview && (
          <div className="stack-gap lead-b2-workflow" style={{ marginTop: '0.75rem' }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              <strong>Bước 1:</strong> Gửi báo cáo 「Liên hệ OK」 · <strong>Bước 2:</strong> Hoàn thành B2 (ghi chú ≥ 3 ký tự).
              Nút bên dưới thực hiện cả hai bước tự động.
            </p>
            <label>
              Báo cáo chăm sóc (Liên hệ OK)
              <textarea
                rows={2}
                value={careReport}
                onChange={(e) => setCareReport(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const out = await submitLeadCareReport(token, leadId, { content: careReport });
                  setFunnel(out.funnel);
                  onFunnelChange?.(out.funnel);
                  setPanelMessage('Đã gửi báo cáo Liên hệ OK');
                  onMessage?.('Đã gửi báo cáo Liên hệ OK');
                  await reload();
                })
              }
            >
              Chỉ gửi báo cáo (bước 1)
            </button>
            <label>
              Ghi chú hoàn thành B2 (≥ 3 ký tự)
              <input
                type="text"
                value={careNote}
                onChange={(e) => setCareNote(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            {!b2ContactOkReported ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Cần gửi báo cáo 「Liên hệ OK」(bước 1) trước khi bấm hoàn thành B2.
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !canCompleteB2}
              title={
                !b2ContactOkReported
                  ? 'Gửi báo cáo Liên hệ OK (bước 1) trước'
                  : careNote.trim().length < 3
                    ? 'Ghi chú hoàn thành B2 cần ≥ 3 ký tự'
                    : undefined
              }
              onClick={() => void finishB2Stage()}
            >
              Hoàn thành B2 (bước 1 + 2)
            </button>
          </div>
        )}
        {funnel.care_pipeline.all_complete && (
          <p style={{ color: '#15803d', marginBottom: 0 }}>✓ B2 đã hoàn thành</p>
        )}
      </div>

      {showPresales && funnel.presales_on_lead_enabled && funnel.presales_care_gate.complete && !inReview && (
        <div className="card-inner" id="funnel-presales">
          <h3 style={{ marginTop: 0 }}>Pre-sales</h3>
          {!funnel.presales && canEdit && (
            <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="muted">Dịch vụ marketing (HĐ)</span>
                <select
                  value={selectedServiceSlug}
                  disabled={busy}
                  onChange={(e) => setSelectedServiceSlug(e.target.value)}
                  style={{ width: '100%', maxWidth: '28rem' }}
                >
                  {presalesServiceOptions.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name} ({item.slug})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !selectedServiceSlug}
                onClick={() =>
                  void run(async () => {
                    const slug = selectedServiceSlug.trim() || DEFAULT_PRESALES_SLUG;
                    const out = await ensureLeadPresales(token, leadId, slug);
                    setFunnel(out.funnel);
                    onFunnelChange?.(out.funnel);
                    onMessage?.('Đã bắt đầu pre-sales');
                  }, true)
                }
              >
                Bắt đầu pre-sales
              </button>
            </div>
          )}
          {funnel.presales && (
            <>
              <p>
                Giai đoạn: <strong>{funnel.presales.presales.stage}</strong> · Dịch vụ:{' '}
                {funnel.presales.presales.service_slug || '—'}
              </p>
              {(funnel.presales.tasks[funnel.presales.presales.stage] ?? []).map((task) => (
                <PresalesTaskFormCard
                  key={task.id}
                  task={task}
                  draft={taskDrafts[task.id] ?? {}}
                  disabled={busy || !canEdit}
                  onDraftChange={(taskId, key, value) =>
                    setTaskDrafts((prev) => ({
                      ...prev,
                      [taskId]: { ...(prev[taskId] ?? {}), [key]: value },
                    }))
                  }
                  onValidationError={(msg) => setPanelError(msg)}
                  onSaveForm={(taskId, formData) =>
                    void run(async () => {
                      const out = await patchLeadPresalesTask(token, leadId, taskId, { form_data: formData });
                      setFunnel(out.funnel);
                    })
                  }
                  onToggleDone={(taskId, nextDone, formData) =>
                    void run(async () => {
                      const out = await patchLeadPresalesTask(token, leadId, taskId, {
                        is_done: nextDone,
                        form_data: formData,
                      });
                      setFunnel(out.funnel);
                      setTaskDrafts((prev) => {
                        const next = { ...prev };
                        delete next[taskId];
                        return next;
                      });
                      onMessage?.(nextDone ? 'Đã hoàn thành task pre-sales' : 'Đã bỏ hoàn thành task');
                    })
                  }
                />
              ))}
              {(funnel.presales.presales.stage === 'lead' || funnel.presales.presales.stage === 'consult') && (
                <p style={{ margin: '0.5rem 0' }}>
                  <Link href={intakeHref} className="nav-link">
                    Mở Lead Intake (BANT) →
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() =>
                      void run(async () => {
                        await reload();
                        onMessage?.('Đã làm mới gate Intake');
                      })
                    }
                  >
                    Làm mới gate
                  </button>
                </p>
              )}
              {consultGate && funnel.presales.presales.stage === 'lead' && (
                <div
                  className="banner"
                  style={{
                    marginBottom: '0.75rem',
                    background: consultGate.ok ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${consultGate.ok ? '#86efac' : '#fecaca'}`,
                  }}
                >
                  <strong>Gate chuyển Tư vấn (Intake)</strong>
                  <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
                    {consultGate.messages.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  {consultGate.bant_total != null && (
                    <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                      BANT {consultGate.bant_total}/30 · decision: {consultGate.decision || '—'}
                    </p>
                  )}
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  title={funnel.presales.advance.block_reason}
                  onClick={() =>
                    void run(async () => {
                      const reason = funnel.presales?.advance.block_reason ?? '';
                      const needsConfirm =
                        !funnel.presales?.advance.can_advance_forward &&
                        (reason.includes('Nurture') ||
                          reason.includes('BANT') ||
                          reason.includes('cân nhắc'));
                      if (
                        !funnel.presales?.advance.can_advance_forward &&
                        !needsConfirm &&
                        !window.confirm(reason || 'Không thể chuyển giai đoạn')
                      ) {
                        return;
                      }
                      if (needsConfirm && !window.confirm(reason || 'Xác nhận chuyển giai đoạn?')) {
                        return;
                      }
                      const out = await advanceLeadPresales(token, leadId, { confirm: true });
                      setFunnel(out.funnel);
                      onFunnelChange?.(out.funnel);
                      onMessage?.('Đã chuyển giai đoạn pre-sales');
                      await reload();
                    }, true)
                  }
                >
                  Chuyển → {funnel.presales.advance.next_stage ?? '—'}
                </button>
              )}
              {!funnel.presales.advance.can_advance_forward && funnel.presales.advance.block_reason && (
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  {funnel.presales.advance.block_reason}
                </p>
              )}

              {funnel.presales.presales.stage === 'proposal' && (
                <div className="stack-gap" style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: 0 }}>KH Marketing sơ bộ @ Proposal</h4>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    Hoàn tất KH MKT sơ bộ rồi tạo HĐ tại{' '}
                    <a href="#lead-contract" className="nav-link">
                      panel Hợp đồng bên dưới
                    </a>
                    .
                  </p>
                  {planValidation.length > 0 && (
                    <ul className="muted" style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.1rem' }}>
                      {planValidation.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                  <label>
                    Tên kế hoạch
                    <input
                      type="text"
                      value={planName}
                      disabled={!canEdit || busy}
                      onChange={(e) => setPlanName(e.target.value)}
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    />
                  </label>
                  <label>
                    North Star
                    <input
                      type="text"
                      value={planNorthStar}
                      disabled={!canEdit || busy}
                      onChange={(e) => setPlanNorthStar(e.target.value)}
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    />
                  </label>
                  <label>
                    Mục tiêu chiến lược
                    <textarea
                      rows={2}
                      value={planObjectives}
                      disabled={!canEdit || busy}
                      onChange={(e) => setPlanObjectives(e.target.value)}
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    />
                  </label>
                  {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        rows={2}
                        value={planStrategy[key] ?? ''}
                        disabled={!canEdit || busy}
                        onChange={(e) =>
                          setPlanStrategy((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        style={{ width: '100%', marginTop: '0.25rem' }}
                      />
                    </label>
                  ))}
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const out = await patchLeadPresalesMarketingPlan(token, leadId, {
                            name: planName,
                            north_star: planNorthStar,
                            objectives: planObjectives,
                            strategy_framework: planStrategy,
                          });
                          setFunnel(out.funnel);
                          onFunnelChange?.(out.funnel);
                          setPlanValidation(out.validation.messages ?? []);
                          onMessage?.('Đã lưu KH MKT sơ bộ');
                        }, true)
                      }
                    >
                      Lưu KH MKT sơ bộ
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

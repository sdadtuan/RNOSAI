'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { EvidenceFormDrawer } from '@/components/research/EvidenceFormDrawer';
import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
import { InsightCard } from '@/components/research/InsightCard';
import { InsightDrawer } from '@/components/research/InsightDrawer';
import { InsightGateDialog } from '@/components/research/InsightGateDialog';
import { DeepResearchModal } from '@/components/research/DeepResearchModal';
import { ResearchJobChip } from '@/components/research/ResearchJobChip';
import { ResearchStatusChip } from '@/components/research/ResearchStatusChip';
import { SourceKeepTable } from '@/components/research/SourceKeepTable';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  addResearchQuestion,
  approveResearchInsight,
  attachResearchInsightEvidence,
  copilotResearchInsight,
  copilotResearchReport,
  createResearchEvidence,
  createResearchInsight,
  createResearchSource,
  deleteResearchQuestion,
  fetchResearchHealth,
  fetchResearchProject,
  runResearchDeep,
  runResearchDesk,
  patchResearchEvidence,
  patchResearchInsight,
  patchResearchProject,
  patchResearchQuestion,
  patchResearchSourceKeep,
  PRODUCT_TYPE_CARDS,
  ResearchApiError,
  STATUS_LABELS,
  submitResearchInsightReview,
  supersedeResearchEvidence,
  TRANSITION_REASON_VI,
  verifyResearchEvidence,
  type CreateEvidenceBody,
  type CreateInsightBody,
  type InsightStatus,
  type ProjectStatus,
  type ResearchAiRun,
  type ResearchEvidence,
  type ResearchInsight,
  type ResearchProject,
  type ResearchQuestion,
  type ResearchReportSnapshot,
  type ResearchSource,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';

const TABS = [
  { id: 'brief', label: 'Brief' },
  { id: 'sources', label: 'Nguồn' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'insights', label: 'Insight' },
  { id: 'report', label: 'Báo cáo' },
  { id: 'activity', label: 'Nhật ký' },
] as const;

export default function CrmResearchWorkspacePage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải…</p>}>
      <CrmResearchWorkspaceContent />
    </Suspense>
  );
}

function CrmResearchWorkspaceContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const tab = searchParams.get('tab') || 'brief';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newRq, setNewRq] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'supersede'>('create');
  const [drawerSource, setDrawerSource] = useState<ResearchSource | null>(null);
  const [drawerEvidence, setDrawerEvidence] = useState<ResearchEvidence | null>(null);
  const [piiWarning, setPiiWarning] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState<ResearchInsight | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMessages, setGateMessages] = useState<string[]>([]);
  const [deskQuestionId, setDeskQuestionId] = useState<number | null>(null);
  const [deskRunId, setDeskRunId] = useState<number | null>(null);
  const [deskBanner, setDeskBanner] = useState('');
  const [deepProvider, setDeepProvider] = useState<string>('off');
  const [deepOpen, setDeepOpen] = useState(false);
  const [deepRunId, setDeepRunId] = useState<number | null>(null);
  const [deepBanner, setDeepBanner] = useState('');
  const [reportSnapshot, setReportSnapshot] = useState<ResearchReportSnapshot | null>(null);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_research', 'view')) {
        setError('Không có quyền xem nghiên cứu thị trường');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const load = useCallback(
    async (access: string) => {
      const data = await fetchResearchProject(access, id);
      setProject(data);
      if (data.deep_research_provider) {
        setDeepProvider(data.deep_research_provider);
      } else {
        try {
          const health = await fetchResearchHealth(access);
          setDeepProvider(health.deep_provider);
        } catch {
          setDeepProvider('off');
        }
      }
    },
    [id],
  );

  useEffect(() => {
    void (async () => {
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        await load(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, load]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function onStatus(next: ProjectStatus) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const updated = await patchResearchProject(access, project.id, { status: next });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi trạng thái thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAddRq() {
    const access = getAccessToken();
    if (!access || !project || !newRq.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addResearchQuestion(access, project.id, { question_vi: newRq.trim() });
      setNewRq('');
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onPatchRq(q: ResearchQuestion, question_vi: string) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchQuestion(access, q.id, { question_vi });
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sửa câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteRq(q: ResearchQuestion) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await deleteResearchQuestion(access, q.id);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xoá câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  function openCreateEvidence(source?: ResearchSource | null) {
    setDrawerMode('create');
    setDrawerSource(source ?? null);
    setDrawerEvidence(null);
    setPiiWarning(false);
    setDrawerOpen(true);
  }

  function openEditEvidence(ev: ResearchEvidence) {
    const src = (project?.sources ?? []).find((s) => s.id === ev.source_id) ?? null;
    setDrawerMode('edit');
    setDrawerSource(src);
    setDrawerEvidence(ev);
    setPiiWarning(Boolean(ev.pii_warning));
    setDrawerOpen(true);
  }

  function openSupersede(ev: ResearchEvidence) {
    const src = (project?.sources ?? []).find((s) => s.id === ev.source_id) ?? null;
    setDrawerMode('supersede');
    setDrawerSource(src);
    setDrawerEvidence(ev);
    setPiiWarning(false);
    setDrawerOpen(true);
  }

  async function onKeepSource(source: ResearchSource, keep: boolean) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchSourceKeep(access, source.id, keep);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật keep thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateManual(input: {
    title: string;
    url?: string;
    publisher?: string;
    question_id?: number | null;
  }) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await createResearchSource(access, project.id, input);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm nguồn thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEvidence(body: CreateEvidenceBody) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      if (drawerMode === 'supersede' && drawerEvidence) {
        const out = await supersedeResearchEvidence(access, drawerEvidence.id, body);
        setPiiWarning(Boolean(out.evidence.pii_warning));
      } else if (drawerMode === 'edit' && drawerEvidence) {
        const out = await patchResearchEvidence(access, drawerEvidence.id, body);
        setPiiWarning(Boolean(out.pii_warning));
      } else {
        const out = await createResearchEvidence(access, project.id, body);
        setPiiWarning(Boolean(out.pii_warning));
      }
      await load(access);
      setDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu evidence thất bại');
    } finally {
      setSaving(false);
    }
  }

  function openGate(err: unknown): boolean {
    if (!(err instanceof ResearchApiError)) return false;
    if (err.code === 'insight_gate') {
      setGateMessages(err.messages?.length ? err.messages : ['insight_gate']);
      setGateOpen(true);
      return true;
    }
    if (err.code === 'cannot_self_approve') {
      setGateMessages(['cannot_self_approve']);
      setGateOpen(true);
      return true;
    }
    return false;
  }

  function isInsightCreator(insight: ResearchInsight | null): boolean {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return false;
    if (!insight?.created_by) return true;
    return insight.created_by.trim().toLowerCase() === email;
  }

  async function persistInsight(body: CreateInsightBody, evidenceIds: number[]): Promise<ResearchInsight | null> {
    const access = getAccessToken();
    if (!access || !project) return null;
    const saved = activeInsight
      ? await patchResearchInsight(access, activeInsight.id, body)
      : await createResearchInsight(access, project.id, body);
    const attached = await attachResearchInsightEvidence(access, saved.id, evidenceIds);
    setActiveInsight(attached);
    await load(access);
    return attached;
  }

  async function onSaveInsight(body: CreateInsightBody, evidenceIds: number[]) {
    setSaving(true);
    setError('');
    try {
      await persistInsight(body, evidenceIds);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Lưu insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitInsight(insight: ResearchInsight, body?: CreateInsightBody, evidenceIds?: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      let target = insight;
      if (body) {
        const saved = await persistInsight(body, evidenceIds ?? insight.evidence_ids);
        if (!saved) return;
        target = saved;
      }
      await submitResearchInsightReview(access, target.id);
      await load(access);
      setInsightOpen(false);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Gửi duyệt thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onApproveInsight(target: Extract<InsightStatus, 'approved_internal' | 'approved_client_facing'>) {
    const access = getAccessToken();
    if (!access || !activeInsight) return;
    setSaving(true);
    setError('');
    try {
      await approveResearchInsight(access, activeInsight.id, { target_status: target });
      await load(access);
      setInsightOpen(false);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Duyệt insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onInsightCopilot(evidenceIds: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await copilotResearchInsight(access, project.id, evidenceIds);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gợi ý insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onReportCopilot(insightIds: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const out = await copilotResearchReport(access, project.id, insightIds);
      setReportSnapshot(out.content_snapshot);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gợi ý dàn báo cáo thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onVerifyEvidence(ev: ResearchEvidence) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await verifyResearchEvidence(access, ev.id);
      await load(access);
      setDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onRunDesk(questionId?: number | null) {
    const access = getAccessToken();
    const qid = questionId ?? deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setDeskBanner('');
    try {
      const out = await runResearchDesk(access, project.id, qid);
      setDeskQuestionId(qid);
      setDeskRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setDeskBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Desk thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunDeep() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setDeepBanner('');
    try {
      const out = await runResearchDeep(access, project.id, qid);
      setDeskQuestionId(qid);
      setDeepRunId(out.run_id);
      setDeepOpen(false);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setDeepBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else if (err instanceof ResearchApiError && err.code === 'deep_research_disabled') {
        setError(TRANSITION_REASON_VI.deep_research_disabled);
        setDeepOpen(false);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Deep Research thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDeepSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setDeepBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setDeepBanner('');
      setDeepRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onDeskSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setDeskBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setDeskBanner('');
      setDeskRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  if (!isMarketResearchFeEnabled()) {
    const body = (
      <div className="page-card">
        <p>Module nghiên cứu thị trường chưa bật.</p>
      </div>
    );
    if (!user) return body;
    return (
      <StaffPageShell user={user} onLogout={logout}>
        {body}
      </StaffPageShell>
    );
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const typeLabel = PRODUCT_TYPE_CARDS.find((c) => c.type === project?.product_type)?.label;
  const canEdit = hasCap(user, 'crm_research', 'edit');
  const canApprove = hasCap(user, 'crm_research', 'approve');
  const canRun = hasCap(user, 'crm_research', 'run');

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: `/crm/research/${id}`, label: project?.title ?? `#${id}` },
      ]}
    >
      <div className="page-card stack-gap">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {project ? (
          <>
            <header>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {project.client_name || project.client_id} · {project.title}
                </h1>
                {canEdit ? (
                  <label>
                    Đổi trạng thái
                    <select
                      className="kpi-input"
                      value={project.status}
                      disabled={saving}
                      onChange={(e) => void onStatus(e.target.value as ProjectStatus)}
                      style={{ display: 'block', marginTop: 4 }}
                    >
                      <option value={project.status}>{STATUS_LABELS[project.status]}</option>
                      {(project.valid_transitions ?? []).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <ResearchStatusChip status={project.status} />
                )}
              </div>
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                {typeLabel ?? project.product_type} · DV12 {project.dv12_tier} · {project.geo.join(', ')} · Rủi
                ro: {project.risk_class}
              </p>
              <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                Trạng thái: {STATUS_LABELS[project.status]} · Owner: {project.created_by ?? '—'}
              </p>
            </header>
            <nav style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid #d8e0d8' }}>
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={`/crm/research/${id}?tab=${t.id}`}
                  className="nav-link"
                  style={{
                    paddingBottom: 8,
                    borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                    fontWeight: tab === t.id ? 700 : 400,
                  }}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            {tab === 'brief' ? (
              <BriefTab
                project={project}
                canEdit={canEdit}
                newRq={newRq}
                setNewRq={setNewRq}
                saving={saving}
                onAddRq={() => void onAddRq()}
                onPatchRq={onPatchRq}
                onDeleteRq={onDeleteRq}
              />
            ) : tab === 'sources' ? (
              <section className="card" style={{ padding: '0.9rem' }}>
                <SourcesDeskBar
                  project={project}
                  canRun={canRun}
                  saving={saving}
                  questionId={deskQuestionId ?? project.questions?.[0]?.id ?? null}
                  runId={deskRunId}
                  banner={deskBanner}
                  deepProvider={deepProvider}
                  deepRunId={deepRunId}
                  deepBanner={deepBanner}
                  onQuestionChange={setDeskQuestionId}
                  onRun={() => void onRunDesk()}
                  onRetry={() => void onRunDesk(deskQuestionId ?? project.questions?.[0]?.id)}
                  onSettled={onDeskSettled}
                  onOpenDeep={() => setDeepOpen(true)}
                  onDeepSettled={onDeepSettled}
                />
                <SourceKeepTable
                  sources={project.sources ?? []}
                  questions={project.questions ?? []}
                  canEdit={canEdit}
                  saving={saving}
                  onKeep={onKeepSource}
                  onCreateManual={onCreateManual}
                  onCreateEvidence={openCreateEvidence}
                />
              </section>
            ) : tab === 'evidence' ? (
              <EvidenceTab
                project={project}
                canEdit={canEdit}
                saving={saving}
                onCreate={() => openCreateEvidence(null)}
                onOpen={openEditEvidence}
                onSupersede={openSupersede}
              />
            ) : tab === 'insights' ? (
              <InsightsTab
                project={project}
                canEdit={canEdit}
                canRun={canRun}
                saving={saving}
                onCreate={() => {
                  setActiveInsight(null);
                  setInsightOpen(true);
                }}
                onOpen={(insight) => {
                  setActiveInsight(insight);
                  setInsightOpen(true);
                }}
                onSubmitReview={(insight) => void onSubmitInsight(insight)}
                onCopilot={(ids) => void onInsightCopilot(ids)}
              />
            ) : tab === 'report' ? (
              <ReportTab
                project={project}
                canRun={canRun}
                saving={saving}
                snapshot={reportSnapshot}
                onCopilot={(ids) => void onReportCopilot(ids)}
              />
            ) : (
              <p className="muted">P0: dùng tab Brief / Nguồn / Evidence / Insight. Tab {TABS.find((t) => t.id === tab)?.label} sẽ có ở milestone sau.</p>
            )}
            <EvidenceFormDrawer
              open={drawerOpen}
              mode={drawerMode}
              canEdit={canEdit}
              saving={saving}
              sources={project.sources ?? []}
              questions={project.questions ?? []}
              source={drawerSource}
              evidence={drawerEvidence}
              piiWarning={piiWarning}
              onClose={() => setDrawerOpen(false)}
              onSave={onSaveEvidence}
              onVerify={onVerifyEvidence}
            />
            <InsightDrawer
              open={insightOpen}
              insight={activeInsight}
              evidence={project.evidence ?? []}
              canEdit={canEdit}
              canApprove={canApprove}
              isCreator={isInsightCreator(activeInsight)}
              saving={saving}
              onClose={() => setInsightOpen(false)}
              onSave={onSaveInsight}
              onSubmitReview={(body, evidenceIds) =>
                void onSubmitInsight(activeInsight ?? { id: 0, evidence_ids: evidenceIds } as ResearchInsight, body, evidenceIds)
              }
              onApprove={onApproveInsight}
            />
            <InsightGateDialog open={gateOpen} messages={gateMessages} onClose={() => setGateOpen(false)} />
            <DeepResearchModal
              open={deepOpen}
              provider={deepProvider}
              questionLabel={
                project.questions?.find((q) => q.id === (deskQuestionId ?? project.questions?.[0]?.id))
                  ?.question_vi ?? '—'
              }
              saving={saving}
              onClose={() => setDeepOpen(false)}
              onConfirm={() => void onRunDeep()}
            />
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

function SourcesDeskBar({
  project,
  canRun,
  saving,
  questionId,
  runId,
  banner,
  deepProvider,
  deepRunId,
  deepBanner,
  onQuestionChange,
  onRun,
  onRetry,
  onSettled,
  onOpenDeep,
  onDeepSettled,
}: {
  project: ResearchProject;
  canRun: boolean;
  saving: boolean;
  questionId: number | null;
  runId: number | null;
  banner: string;
  deepProvider: string;
  deepRunId: number | null;
  deepBanner: string;
  onQuestionChange: (id: number) => void;
  onRun: () => void;
  onRetry: () => void;
  onSettled: (run: ResearchAiRun) => void;
  onOpenDeep: () => void;
  onDeepSettled: (run: ResearchAiRun) => void;
}) {
  const questions = project.questions ?? [];
  const used = project.tavily_credits_used ?? 0;
  const limit = project.tavily_credits_limit ?? 12;
  const inFlight = Boolean(runId) && !banner;
  const failed = Boolean(banner);
  const deepEnabled = deepProvider && deepProvider !== 'off';
  const deepInFlight = Boolean(deepRunId) && !deepBanner;
  return (
    <div className="stack-gap" style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Câu hỏi
          <select
            className="kpi-input"
            value={questionId ?? ''}
            disabled={!canRun || saving || questions.length === 0}
            onChange={(e) => onQuestionChange(Number(e.target.value))}
            style={{ display: 'block', marginTop: 4 }}
          >
            {questions.length === 0 ? <option value="">Chưa có RQ</option> : null}
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.sort_order}: {q.question_vi}
              </option>
            ))}
          </select>
        </label>
        {canRun ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || inFlight}
            title={inFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={failed ? onRetry : onRun}
          >
            {failed ? 'Thử lại Desk' : 'Chạy Desk Tavily'}
          </button>
        ) : null}
        {canRun && deepEnabled ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || deepInFlight}
            title={deepInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={onOpenDeep}
          >
            Chạy Deep Research
          </button>
        ) : null}
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={runId}
          onSettled={onSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={deepRunId}
          kind="deep"
          onSettled={onDeepSettled}
        />
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Tavily {used}/{limit} credit dự án
        </span>
      </div>
      {banner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {banner}
        </p>
      ) : null}
      {deepBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {deepBanner}
        </p>
      ) : null}
    </div>
  );
}

function BriefTab({
  project,
  canEdit,
  newRq,
  setNewRq,
  saving,
  onAddRq,
  onPatchRq,
  onDeleteRq,
}: {
  project: ResearchProject;
  canEdit: boolean;
  newRq: string;
  setNewRq: (v: string) => void;
  saving: boolean;
  onAddRq: () => void;
  onPatchRq: (q: ResearchQuestion, question_vi: string) => Promise<void>;
  onDeleteRq: (q: ResearchQuestion) => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
      <div className="stack-gap">
        <section className="card" style={{ padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Quyết định</h2>
          <p style={{ margin: 0 }}>{project.decision_statement}</p>
        </section>
        <section className="card" style={{ padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Câu hỏi nghiên cứu</h2>
          {(project.questions ?? []).length === 0 ? (
            <p className="muted" title={TRANSITION_REASON_VI.need_rq}>
              Cần ≥1 câu hỏi nghiên cứu để chuyển Thiết kế.
            </p>
          ) : null}
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {(project.questions ?? []).map((q) => (
              <li key={q.id} style={{ marginBottom: '0.6rem' }}>
                {canEdit ? (
                  <RqInline q={q} disabled={saving} onSave={onPatchRq} onDelete={onDeleteRq} />
                ) : (
                  q.question_vi
                )}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddRq();
              }}
              style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}
            >
              <input
                className="kpi-input"
                value={newRq}
                onChange={(e) => setNewRq(e.target.value)}
                placeholder="Thêm câu hỏi…"
                disabled={saving}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-sm btn-secondary" disabled={saving || !newRq.trim()}>
                + Thêm
              </button>
            </form>
          ) : null}
        </section>
      </div>
      <aside className="card" style={{ padding: '0.9rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>SOP G0–G10</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li style={{ fontWeight: 700 }}>G0 Intake — brief + RQ</li>
          <li>G1 Design</li>
          <li>G2 Collect</li>
          <li>G3 QC</li>
          <li>G4 Analyze</li>
          <li>G5 Synthesize</li>
          <li>G6 Draft</li>
          <li>G7 Review</li>
          <li>G8 Approve</li>
          <li>G9 Distribute</li>
          <li>G10 Archive</li>
        </ol>
      </aside>
    </div>
  );
}

function InsightsTab({
  project,
  canEdit,
  canRun,
  saving,
  onCreate,
  onOpen,
  onSubmitReview,
  onCopilot,
}: {
  project: ResearchProject;
  canEdit: boolean;
  canRun: boolean;
  saving: boolean;
  onCreate: () => void;
  onOpen: (insight: ResearchInsight) => void;
  onSubmitReview: (insight: ResearchInsight) => void;
  onCopilot: (evidenceIds: number[]) => void;
}) {
  const rows = project.insights ?? [];
  const verified = (project.evidence ?? []).filter((ev) => ev.qc_status === 'verified');
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Insight</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canRun ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving || selected.length === 0}
              title={selected.length === 0 ? 'Chọn ≥1 evidence đã verify' : undefined}
              onClick={() => onCopilot(selected)}
            >
              Gợi ý insight (Claude)
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={onCreate}>
              + Insight
            </button>
          ) : null}
        </div>
      </div>
      {canRun ? (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
            Chọn evidence đã verify — Claude chỉ được dùng các ID này.
          </p>
          {verified.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Chưa có evidence verified — nút gợi ý tắt.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {verified.map((ev) => {
                const checked = selected.includes(ev.id);
                return (
                  <label
                    key={ev.id}
                    style={{
                      display: 'inline-flex',
                      gap: 6,
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      border: '1px solid #d8e0d8',
                      borderRadius: 8,
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() =>
                        setSelected((prev) =>
                          checked ? prev.filter((id) => id !== ev.id) : [...prev, ev.id],
                        )
                      }
                    />
                    EV-{ev.id}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="muted">Gắn evidence rồi soạn insight — không viết từ AI suông.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          {rows.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              evidence={project.evidence ?? []}
              canEdit={canEdit}
              saving={saving}
              onOpen={onOpen}
              onSubmitReview={onSubmitReview}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const APPROVED_INTERNAL_PLUS: InsightStatus[] = [
  'approved_internal',
  'approved_client_facing',
  'published',
];

function ReportTab({
  project,
  canRun,
  saving,
  snapshot,
  onCopilot,
}: {
  project: ResearchProject;
  canRun: boolean;
  saving: boolean;
  snapshot: ResearchReportSnapshot | null;
  onCopilot: (insightIds: number[]) => void;
}) {
  const approved = (project.insights ?? []).filter((row) => APPROVED_INTERNAL_PLUS.includes(row.status));
  const [selected, setSelected] = useState<number[]>(() => approved.map((row) => row.id));
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Báo cáo</h2>
        {canRun ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || selected.length === 0}
            title={selected.length === 0 ? 'Chọn ≥1 insight đã duyệt nội bộ' : undefined}
            onClick={() => onCopilot(selected)}
          >
            Gợi ý dàn báo cáo
          </button>
        ) : null}
      </div>
      <p className="muted" style={{ margin: '0.5rem 0 0.75rem' }}>
        Dàn ý nháp từ insight đã duyệt. Xuất DOCX ở milestone sau — không phát hành.
      </p>
      {approved.length === 0 ? (
        <p className="muted">Chưa có insight approved_internal+.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {approved.map((insight) => {
            const checked = selected.includes(insight.id);
            return (
              <label
                key={insight.id}
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  border: '1px solid #d8e0d8',
                  borderRadius: 8,
                  padding: '0.25rem 0.5rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={() =>
                    setSelected((prev) =>
                      checked ? prev.filter((id) => id !== insight.id) : [...prev, insight.id],
                    )
                  }
                />
                #{insight.id}
                {insight.ai_generated ? ' · AI' : ''}
              </label>
            );
          })}
        </div>
      )}
      {snapshot ? (
        <pre
          style={{
            margin: 0,
            padding: '0.75rem',
            background: '#f6f7f6',
            borderRadius: 8,
            overflow: 'auto',
            fontSize: '0.8rem',
          }}
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

function EvidenceTab({
  project,
  canEdit,
  saving,
  onCreate,
  onOpen,
  onSupersede,
}: {
  project: ResearchProject;
  canEdit: boolean;
  saving: boolean;
  onCreate: () => void;
  onOpen: (ev: ResearchEvidence) => void;
  onSupersede: (ev: ResearchEvidence) => void;
}) {
  const rows = project.evidence ?? [];
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Evidence</h2>
        {canEdit ? (
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onCreate}>
            + Evidence
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="muted">Chưa có evidence. Tạo từ nguồn đã keep hoặc nút + Evidence.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>RQ</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Locator</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Excerpt / Value</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Unit</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Period</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Geo</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>QC</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => {
                const rq = (project.questions ?? []).find((q) => q.id === ev.question_id);
                const verified = ev.qc_status === 'verified';
                const locked = verified || ev.qc_status === 'superseded' || ev.qc_status === 'rejected';
                return (
                  <tr key={ev.id}>
                    <td style={{ padding: '0.4rem' }}>
                      <EvidenceIdChip id={ev.id} locator={ev.locator} />
                    </td>
                    <td style={{ padding: '0.4rem' }}>{rq ? `Q${rq.sort_order}` : '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.locator}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {locked ? '🔒 ' : ''}
                      {ev.excerpt || (ev.value_num != null ? String(ev.value_num) : '—')}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{ev.unit || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.period_note || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.geography || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.qc_status}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {canEdit && !locked ? (
                        <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => onOpen(ev)}>
                          Mở
                        </button>
                      ) : null}
                      {canEdit && verified ? (
                        <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => onSupersede(ev)}>
                          Thay thế (supersede)
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RqInline({
  q,
  disabled,
  onSave,
  onDelete,
}: {
  q: ResearchQuestion;
  disabled: boolean;
  onSave: (q: ResearchQuestion, question_vi: string) => Promise<void>;
  onDelete: (q: ResearchQuestion) => Promise<void>;
}) {
  const [value, setValue] = useState(q.question_vi);
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      <input
        className="kpi-input"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        style={{ flex: 1, minWidth: 180 }}
      />
      <button
        type="button"
        className="btn btn-sm"
        disabled={disabled || !value.trim() || value === q.question_vi}
        onClick={() => void onSave(q, value.trim())}
      >
        Lưu
      </button>
      <button type="button" className="btn btn-sm btn-secondary" disabled={disabled} onClick={() => void onDelete(q)}>
        Xoá
      </button>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { EvidenceFormDrawer } from '@/components/research/EvidenceFormDrawer';
import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
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
  createResearchEvidence,
  createResearchSource,
  deleteResearchQuestion,
  fetchResearchProject,
  patchResearchEvidence,
  patchResearchProject,
  patchResearchQuestion,
  patchResearchSourceKeep,
  PRODUCT_TYPE_CARDS,
  STATUS_LABELS,
  supersedeResearchEvidence,
  TRANSITION_REASON_VI,
  verifyResearchEvidence,
  type CreateEvidenceBody,
  type ProjectStatus,
  type ResearchEvidence,
  type ResearchProject,
  type ResearchQuestion,
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
            ) : (
              <p className="muted">P0: dùng tab Brief / Nguồn / Evidence. Tab {TABS.find((t) => t.id === tab)?.label} sẽ có ở milestone sau.</p>
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
          </>
        ) : null}
      </div>
    </StaffPageShell>
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

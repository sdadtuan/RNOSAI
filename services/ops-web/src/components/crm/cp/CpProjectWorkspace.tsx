'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  closeCpProject,
  createCpProjectBrief,
  createCpProjectDeliverable,
  createCpProjectTask,
  exportCpReport,
  formatCpApiError,
  getCpProject,
  getCpProjectLookups,
  getCpVideoVersion,
  listActivity,
  listCpAssets,
  listCpProjectBriefs,
  listCpProjectDeliverables,
  listCpProjectTasks,
  patchCpProject,
  submitCpProjectCreative,
  type CpActivity,
  type CpAsset,
  type CpBrief,
  type CpDeliverable,
  type CpProject,
  type CpProjectLookups,
  type CpTask,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import { formatLifecycleOption } from '@/lib/crm/cp-project-form.util';
import {
  CP_PROJECT_TABS,
  type CpProjectTabId,
} from '@/lib/crm/cp-project-tabs.util';
import {
  formatCreditPct,
  formatDeliverableCount,
  portfolioPillClass,
  portfolioStatusLabel,
} from '@/lib/crm/cp-portfolio.util';
import {
  approvalSteps,
  briefSections,
  budgetBanner,
  budgetLines,
  creditPctNumber,
  daysRemaining,
  deliverableCta,
  deliverableThumb,
  formatCreditLine,
  formatDaysRemaining,
  formatMemberLine,
  overviewAlert,
  priorityPillClass,
  projectAssets,
  rightsBadge,
  taskSource,
  videoFinalCount,
} from '@/lib/crm/cp-project-workspace.util';
import {
  canSubmitCreativeToHub,
  type QcFetchState,
} from '@/lib/crm/cp-review.util';

const EMPTY_LOOKUPS: CpProjectLookups = { clients: [], staff: [], lifecycles: [] };

function formatDate(value: string | null | undefined): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('vi-VN').format(parsed)
    : value;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(parsed)
    : value;
}

function isTab(value: string | null): value is CpProjectTabId {
  return CP_PROJECT_TABS.some((tab) => tab.id === value);
}

export function CpProjectWorkspace({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const activeTab: CpProjectTabId = isTab(searchParams.get('tab'))
    ? searchParams.get('tab') as CpProjectTabId
    : 'overview';
  const [project, setProject] = useState<CpProject | null>(null);
  const [briefs, setBriefs] = useState<CpBrief[]>([]);
  const [deliverables, setDeliverables] = useState<CpDeliverable[]>([]);
  const [tasks, setTasks] = useState<CpTask[]>([]);
  const [activity, setActivity] = useState<CpActivity[]>([]);
  const [assets, setAssets] = useState<CpAsset[]>([]);
  const [lookups, setLookups] = useState<CpProjectLookups>(EMPTY_LOOKUPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [qcFetch, setQcFetch] = useState<QcFetchState>({ phase: 'idle' });

  const href = (tab: string) => `/crm/creative-os/projects/${projectId}?tab=${tab}`;

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [projectOut, briefOut, deliverableOut, taskOut, activityOut, assetOut, lookupOut] =
        await Promise.all([
          getCpProject(token, projectId),
          listCpProjectBriefs(token, projectId),
          listCpProjectDeliverables(token, projectId),
          listCpProjectTasks(token, projectId),
          listActivity(token),
          listCpAssets(token),
          getCpProjectLookups(token).catch(() => EMPTY_LOOKUPS),
        ]);
      setProject(projectOut);
      setBriefs(briefOut.items);
      setDeliverables(deliverableOut.items);
      setTasks(taskOut.items);
      setActivity(activityOut.items.filter((item) => item.resource_id === projectId));
      setAssets(projectAssets(assetOut.items, projectId));
      setLookups(lookupOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được workspace');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const versionOptions = useMemo(
    () => deliverables.filter((item) => item.video_version_id),
    [deliverables],
  );
  const canSubmitHub = canSubmitCreativeToHub(selectedVersionId, qcFetch);

  useEffect(() => {
    if (!selectedVersionId && versionOptions[0]?.video_version_id) {
      setSelectedVersionId(String(versionOptions[0].video_version_id));
    }
  }, [selectedVersionId, versionOptions]);

  useEffect(() => {
    if (!selectedVersionId) {
      setQcFetch({ phase: 'idle' });
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setQcFetch({ phase: 'error' });
      return;
    }
    setQcFetch({ phase: 'loading' });
    let cancelled = false;
    void getCpVideoVersion(token, selectedVersionId)
      .then((version) => {
        if (!cancelled) {
          setQcFetch({ phase: 'resolved', qcStatus: version.qc_status ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setQcFetch({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersionId]);

  const latestBrief = briefs[0] ?? null;
  const sections = briefSections(latestBrief?.body_json);
  const creditPct = creditPctNumber(project?.credit_used, project?.credit_budget);
  const alertText = overviewAlert({
    creditPct,
    overdueDeliverables: project?.overdue_deliverables ?? 0,
    clientReviewOverSla: false,
  });
  const banner = budgetBanner(creditPct);
  const doneLabel = formatDeliverableCount(
    project?.deliverable_done ?? deliverables.filter((item) =>
      ['approved', 'completed', 'final', 'published'].includes(item.status),
    ).length,
    project?.deliverable_total ?? deliverables.length,
  );
  const finalVideos = project?.video_final ?? videoFinalCount(deliverables);
  const daysLeft = formatDaysRemaining(daysRemaining(project?.due_at));
  const creditLine = formatCreditLine(project?.credit_used, project?.credit_budget);
  const lifecycleLabel = project?.lifecycle_id
    ? formatLifecycleOption({ id: project.lifecycle_id, service_slug: project.lifecycle_name })
    : dash(null);
  const clientStatus = deliverables.find((item) => item.status === 'client_review')?.status
    ?? (latestBrief?.approval_status === 'client_review' ? 'client_review' : null);
  const legalStatus = [latestBrief?.approval_status, ...deliverables.map((item) => item.status)]
    .find((status) => status === 'legal_approved') ?? null;
  const steps = approvalSteps({
    briefStatus: latestBrief?.approval_status,
    clientStatus,
    legalStatus,
    qcStatus: qcFetch.phase === 'resolved' ? qcFetch.qcStatus : null,
  });
  const lines = budgetLines({
    budget: project?.credit_budget,
    charged: project?.credit_charged,
    reserved: project?.credit_reserved,
    byCostCenter: project?.budget_by_cost_center,
  });

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const updated = await patchCpProject(token, projectId, {
        status: String(form.get('status') ?? 'draft'),
      });
      setProject(updated);
      setNotice('Đã cập nhật trạng thái.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được project');
    } finally {
      setSaving(false);
    }
  }

  async function closeProject() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const updated = await closeCpProject(token, projectId);
      setProject(updated);
      setNotice('Project đã đóng.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.message === 'pending_deliverables') {
        setError('Không thể đóng project vì còn deliverable đang chờ xử lý.');
      } else {
        setError(err instanceof Error ? err.message : 'Không đóng được project');
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveBrief(formElement: HTMLFormElement, approvalStatus: string) {
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    try {
      await createCpProjectBrief(token, projectId, {
        body_json: {
          context: String(form.get('context') ?? '').trim(),
          objective: String(form.get('objective') ?? '').trim(),
          message_cta: String(form.get('message_cta') ?? '').trim(),
          constraints: String(form.get('constraints') ?? '').trim(),
        },
        approval_status: approvalStatus,
      });
      formElement.reset();
      setNotice(approvalStatus === 'brand_review' ? 'Đã gửi duyệt Brand.' : 'Đã tạo revision brief.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được brief');
    } finally {
      setSaving(false);
    }
  }

  async function addDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    const type = String(form.get('type') ?? 'ai_video');
    setSaving(true);
    setError('');
    try {
      await createCpProjectDeliverable(token, projectId, {
        type,
        due_at: String(form.get('due_at') ?? '') || null,
        owner_staff_id: Number(form.get('owner_staff_id')) || null,
        vd_project_id: type === 'human_video'
          ? String(form.get('vd_project_id') ?? '').trim() || null
          : null,
      });
      formElement.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được deliverable');
    } finally {
      setSaving(false);
    }
  }

  async function submitToHub() {
    const token = getAccessToken();
    if (!token || !canSubmitHub) return;
    setSaving(true);
    setError('');
    try {
      const result = await submitCpProjectCreative(token, projectId, selectedVersionId);
      setNotice(`Đã gửi Creative Hub · ${result.creative_id}`);
    } catch (err) {
      setError(formatCpApiError(err, 'Không gửi được Creative Hub'));
    } finally {
      setSaving(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    try {
      await createCpProjectTask(token, projectId, {
        title: String(form.get('title') ?? '').trim(),
        assignee_id: Number(form.get('assignee_id')) || null,
        due_at: String(form.get('due_at') ?? '') || null,
        priority: String(form.get('priority') ?? 'normal'),
      });
      formElement.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được công việc');
    } finally {
      setSaving(false);
    }
  }

  async function exportFinance() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const out = await exportCpReport(token, { slug: 'credit', format: 'csv' });
      if (out.body) {
        const blob = new Blob([out.body], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cp-credit.csv';
        link.click();
        URL.revokeObjectURL(url);
        setNotice('Đã xuất CSV finance.');
      } else {
        setNotice('Không có dữ liệu CSV.');
      }
    } catch (err) {
      setError(formatCpApiError(err, 'Không xuất được CSV'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">
            Vận hành / Sản xuất sáng tạo / {project?.name ?? dash(null)}
          </p>
          <h1>{project?.name ?? (loading ? 'Đang tải…' : dash(null))}</h1>
          <p className="cp-muted">
            PRJ-03 · 8 tab · status {portfolioStatusLabel(project?.status)}
          </p>
        </div>
        <div className="cp-overview__actions">
          <Link className="cp-btn" href={href('timeline')}>Timeline</Link>
          <button
            className="cp-btn"
            type="button"
            disabled={saving || !canSubmitHub}
            title={canSubmitHub ? 'Gửi Creative Hub' : 'Cần version đã QC'}
            onClick={() => void submitToHub()}
          >
            Chia sẻ review (Hub)
          </button>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {notice ? <section className="cp-alert"><span>{notice}</span></section> : null}

      <nav className="cp-chips" aria-label="Project workspace">
        {CP_PROJECT_TABS.map((tab) => (
          <Link
            key={tab.id}
            className={activeTab === tab.id ? 'cp-chip is-on' : 'cp-chip'}
            href={href(tab.id)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          {alertText ? <div className="cp-alert cp-alert--active"><span>{alertText}</span></div> : null}
          <div className="cp-kpi-grid cp-kpi-grid--4">
            <section className="cp-kpi-tile"><span>Deliverable xong</span><strong>{doneLabel}</strong></section>
            <section className="cp-kpi-tile"><span>Video Final</span><strong>{finalVideos || dash(null)}</strong></section>
            <section className="cp-kpi-tile"><span>Ngày còn</span><strong>{daysLeft}</strong></section>
            <section className="cp-kpi-tile"><span>Credit</span><strong>{creditLine}</strong></section>
          </div>
          <div className="cp-overview-grid">
            <section className="cp-card">
              <header className="cp-card__head"><h2>Mục tiêu</h2></header>
              <p>{dash(project?.objective)}</p>
              <p className="cp-muted">
                Deep-link:{' '}
                {project ? (
                  <a className="cp-link" href={`/crm/account-management/clients/${project.agency_client_id}`}>
                    AM 360 {project.client_name || dash(null)}
                  </a>
                ) : dash(null)}
                {' · '}
                {project?.lifecycle_id ? (
                  <a className="cp-link" href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}>
                    {lifecycleLabel} Content OS
                  </a>
                ) : dash(null)}
                {' · Video SOP không clone vào CP.'}
              </p>
            </section>
            <section className="cp-card">
              <header className="cp-card__head"><h2>Member</h2></header>
              <p>{formatMemberLine(project?.members)}</p>
              <p className="cp-muted">Owner: {project?.owner_name || dash(null)}</p>
              <form className="cp-filters" onSubmit={updateStatus}>
                <label>
                  <span>Trạng thái</span>
                  <select name="status" key={project?.status} defaultValue={project?.status ?? 'draft'}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="at_risk">At Risk</option>
                    <option value="in_review">In Review</option>
                  </select>
                </label>
                <button className="cp-btn" type="submit" disabled={saving}>Lưu</button>
              </form>
              <button
                className="cp-btn"
                type="button"
                disabled={saving || !project || ['completed', 'archived'].includes(project.status)}
                onClick={() => void closeProject()}
              >
                Đóng project
              </button>
            </section>
          </div>
        </>
      ) : null}

      {activeTab === 'brief' ? (
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Brief {latestBrief ? `v${latestBrief.version}` : ''}</h2>
            <span className={portfolioPillClass(latestBrief?.approval_status)}>
              {dash(latestBrief?.approval_status)}
            </span>
          </header>
          <p><b>Bối cảnh.</b> {sections.context || dash(null)}</p>
          <p><b>Mục tiêu.</b> {sections.objective || dash(null)}</p>
          <p><b>Thông điệp + CTA.</b> {sections.message_cta || dash(null)}</p>
          <p><b>Ràng buộc.</b> {sections.constraints || dash(null)}</p>
          <p className="cp-muted">Sửa = revision {latestBrief ? `v${latestBrief.version + 1}` : 'v1'}.</p>
          <form className="cp-workspace-form" onSubmit={(event) => { event.preventDefault(); void saveBrief(event.currentTarget, 'draft'); }}>
            <label><span>Bối cảnh</span><textarea name="context" rows={2} defaultValue={sections.context} /></label>
            <label><span>Mục tiêu</span><textarea name="objective" rows={2} defaultValue={sections.objective} /></label>
            <label><span>Thông điệp + CTA</span><textarea name="message_cta" rows={2} defaultValue={sections.message_cta} /></label>
            <label><span>Ràng buộc</span><textarea name="constraints" rows={2} defaultValue={sections.constraints} /></label>
            <div className="cp-overview__actions">
              <button className="cp-btn" disabled={saving} type="submit">Tạo revision</button>
              <button
                className="cp-btn cp-btn--primary"
                disabled={saving}
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form) void saveBrief(form, 'brand_review');
                }}
              >
                Gửi duyệt Brand
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'deliverables' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Deliverables</h2></header>
          {deliverables.length ? (
            <div className="cp-deliverable-grid">
              {deliverables.map((item) => {
                const cta = deliverableCta({ ...item, project_id: projectId });
                return (
                  <article key={item.id} className="cp-card">
                    <div className="cp-thumb">{deliverableThumb(item.type)}</div>
                    <b>{item.type}</b>
                    <p className="cp-muted">
                      {item.type} · {dash(item.status)}
                      {item.owner_name ? ` · ${item.owner_name}` : ''}
                    </p>
                    <p className="cp-muted">Hạn {formatDate(item.due_at)}</p>
                    <Link className="cp-btn" href={cta.href}>{cta.label}</Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="cp-empty">{dash(null)}</p>
          )}
          <form className="cp-filters" onSubmit={addDeliverable}>
            <label>
              <span>Loại</span>
              <select name="type">
                <option value="ai_video">AI video</option>
                <option value="motion">Motion</option>
                <option value="social">Social</option>
                <option value="landing_asset">Landing asset</option>
                <option value="human_video">Human video</option>
              </select>
            </label>
            <label><span>Hạn</span><input name="due_at" type="date" /></label>
            <label>
              <span>Owner</span>
              <select name="owner_staff_id">
                <option value="">—</option>
                {lookups.staff.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </label>
            <label><span>VD project ID</span><input name="vd_project_id" placeholder="human_video" /></label>
            <button className="cp-btn cp-btn--primary" disabled={saving} type="submit">Tạo deliverable video AI</button>
          </form>
        </section>
      ) : null}

      {activeTab === 'tasks' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Công việc</h2></header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Việc</th>
                  <th>Assignee</th>
                  <th>Hạn</th>
                  <th>Prio</th>
                  <th>Status</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length ? tasks.map((task) => {
                  const source = taskSource(task);
                  return (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.assignee_name || dash(null)}</td>
                      <td>{formatDate(task.due_at)}</td>
                      <td><span className={priorityPillClass(task.priority)}>{dash(task.priority)}</span></td>
                      <td><span className="cp-pill">{dash(task.status)}</span></td>
                      <td>
                        {source.href ? <a className="cp-link" href={source.href}>{source.label}</a> : source.label}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td className="cp-empty" colSpan={6}>{dash(null)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="cp-muted">Không clone ticket CSD. Được gắn <code>am_task_id</code> / <code>csd_ticket_id</code>.</p>
          <form className="cp-filters" onSubmit={addTask}>
            <label><span>Tên việc</span><input name="title" required /></label>
            <label>
              <span>Assignee</span>
              <select name="assignee_id">
                <option value="">—</option>
                {lookups.staff.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </label>
            <label><span>Hạn</span><input name="due_at" type="datetime-local" /></label>
            <label>
              <span>Prio</span>
              <select name="priority">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button className="cp-btn cp-btn--primary" disabled={saving} type="submit">Tạo việc</button>
          </form>
        </section>
      ) : null}

      {activeTab === 'media' ? (
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Media</h2>
            <Link className="cp-btn" href={`/crm/creative-os/media?tab=ingest&project=${projectId}`}>
              Upload gán project
            </Link>
          </header>
          {assets.length ? (
            <div className="cp-media-grid">
              {assets.map((asset) => {
                const badge = rightsBadge(asset);
                return (
                  <Link key={asset.id} className="cp-media-card" href={`/crm/creative-os/media/${asset.id}`}>
                    <div className="cp-thumb" />
                    <b>{asset.filename}</b>
                    {badge ? <span className="cp-pill cp-pill--warning">{badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="cp-empty">{dash(null)}</p>
          )}
        </section>
      ) : null}

      {activeTab === 'approvals' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Phê duyệt</h2></header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Bước</th>
                  <th>Rule</th>
                  <th>Actor</th>
                  <th>SLA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((row) => (
                  <tr key={row.step}>
                    <td>{row.step}</td>
                    <td>{row.rule}</td>
                    <td>{row.actor}</td>
                    <td>{row.sla}</td>
                    <td><span className={portfolioPillClass(row.status)}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {versionOptions.length ? (
            <form className="cp-filters" onSubmit={(event) => { event.preventDefault(); void submitToHub(); }}>
              <label>
                <span>Version</span>
                <select
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                >
                  <option value="">Chọn version</option>
                  {versionOptions.map((item) => (
                    <option key={item.id} value={item.video_version_id ?? ''}>
                      {item.type} · {dash(item.video_version_id)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="cp-muted">
                QC:{' '}
                {qcFetch.phase === 'loading'
                  ? 'Đang tải…'
                  : qcFetch.phase === 'error'
                    ? 'Không tải được QC'
                    : dash(qcFetch.phase === 'resolved' ? qcFetch.qcStatus : null)}
              </p>
              <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || !canSubmitHub}>
                Chia sẻ review (Hub)
              </button>
            </form>
          ) : (
            <p className="cp-muted">Chưa có version để gửi Hub · {dash(null)}</p>
          )}
        </section>
      ) : null}

      {activeTab === 'budget' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Ngân sách</h2></header>
          {banner ? <div className="cp-alert cp-alert--active"><span>{banner.text}</span></div> : null}
          <p className="cp-muted">
            Tổng project: {creditLine} · used {formatCreditPct(project?.credit_used, project?.credit_budget)}
          </p>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Hạng</th>
                  <th>Budget</th>
                  <th>Charged</th>
                  <th>Reserved</th>
                  <th>Còn</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.label}>
                    <td>{line.label}</td>
                    <td>{line.budget}</td>
                    <td>{line.charged}</td>
                    <td>{line.reserved}</td>
                    <td>{line.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cp-overview__actions">
            <button className="cp-btn" type="button" disabled={saving} onClick={() => void exportFinance()}>
              Xuất CSV (finance)
            </button>
            <Link className="cp-btn" href="/crm/creative-os/reports?tab=credit">Mở báo cáo credit</Link>
          </div>
        </section>
      ) : null}

      {activeTab === 'activity' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Hoạt động</h2></header>
          {activity.length ? (
            <ul className="cp-timeline">
              {activity.map((item) => (
                <li key={item.id}>
                  <time>{formatTime(item.created_at)}</time>
                  <b>{item.action}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-empty">{dash(null)}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

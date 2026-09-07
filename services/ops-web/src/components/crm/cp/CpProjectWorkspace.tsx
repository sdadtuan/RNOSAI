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
  formatCpApiError,
  getCpProject,
  getCpVideoVersion,
  listActivity,
  listCpProjectBriefs,
  listCpProjectDeliverables,
  listCpProjectTasks,
  patchCpProject,
  submitCpProjectCreative,
  type CpActivity,
  type CpBrief,
  type CpDeliverable,
  type CpProject,
  type CpTask,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import {
  CP_PROJECT_TABS,
  type CpProjectTabId,
} from '@/lib/crm/cp-project-tabs.util';
import {
  canSubmitCreativeToHub,
  type QcFetchState,
} from '@/lib/crm/cp-review.util';

function formatDate(value: string | null | undefined): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('vi-VN').format(parsed)
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [qcFetch, setQcFetch] = useState<QcFetchState>({ phase: 'idle' });

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [projectOut, briefOut, deliverableOut, taskOut, activityOut] = await Promise.all([
        getCpProject(token, projectId),
        listCpProjectBriefs(token, projectId),
        listCpProjectDeliverables(token, projectId),
        listCpProjectTasks(token, projectId),
        listActivity(token),
      ]);
      setProject(projectOut);
      setBriefs(briefOut.items);
      setDeliverables(deliverableOut.items);
      setTasks(taskOut.items);
      setActivity(activityOut.items.filter((item) => item.resource_id === projectId));
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
  const completeDeliverables = useMemo(
    () => deliverables.filter((item) => ['approved', 'completed', 'final', 'published'].includes(item.status)).length,
    [deliverables],
  );

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

  async function addBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    try {
      await createCpProjectBrief(token, projectId, {
        body_json: { content: String(form.get('content') ?? '').trim() },
        approval_status: 'draft',
      });
      formElement.reset();
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

  function emptyBody(title: string) {
    return <section className="cp-card"><header className="cp-card__head"><h2>{title}</h2></header><p className="cp-muted">Chưa có dữ liệu</p><p className="cp-empty">{dash(null)}</p></section>;
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / {project?.name ?? dash(null)}</p>
          <h1>{project?.name ?? (loading ? 'Đang tải…' : dash(null))}</h1>
          <p className="cp-muted">Workspace project · trạng thái {dash(project?.status)}</p>
        </div>
        <div>
          <Link className="cp-btn" href={`/crm/creative-os/projects/${projectId}?tab=timeline`}>Timeline</Link>
          {' '}
          <button className="cp-btn" type="button" disabled title="Cần version đã QC">Chia sẻ review</button>
          <p className="cp-muted">Cần version đã QC</p>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      {notice ? <section className="cp-alert"><span>{notice}</span></section> : null}

      <nav className="cp-filters" aria-label="Project workspace">
        {CP_PROJECT_TABS.map((tab) => (
          <Link
            key={tab.id}
            className={activeTab === tab.id ? 'cp-btn cp-btn--primary' : 'cp-btn'}
            href={`/crm/creative-os/projects/${projectId}?tab=${tab.id}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          <div className="cp-kpi-grid">
            <section className="cp-kpi-tile"><span>Deliverable xong</span><strong>{completeDeliverables} / {deliverables.length}</strong></section>
            <section className="cp-kpi-tile"><span>Hạn</span><strong>{formatDate(project?.due_at)}</strong></section>
            <section className="cp-kpi-tile"><span>Credit budget</span><strong>{dash(project?.credit_budget)}</strong></section>
          </div>
          <div className="cp-overview-grid">
            <section className="cp-card">
              <header className="cp-card__head"><h2>Mục tiêu</h2></header>
              <p>{dash(project?.objective)}</p>
              <p className="cp-muted">
                Khách: {project ? <a className="cp-link" href={`/crm/account-management/clients/${project.agency_client_id}`}>{project.agency_client_id}</a> : dash(null)}
                {' · Lifecycle: '}
                {project?.lifecycle_id ? <a className="cp-link" href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}>{project.lifecycle_id}</a> : dash(null)}
              </p>
            </section>
            <section className="cp-card">
              <header className="cp-card__head"><h2>Quản trị</h2></header>
              <p>Owner: {dash(project?.owner_staff_id)}</p>
              <p>Members: {project?.member_staff_ids?.length ? project.member_staff_ids.join(', ') : dash(null)}</p>
              <p>Cost center: {dash(project?.cost_center)}</p>
              <form className="cp-filters" onSubmit={updateStatus}>
                <label><span>Trạng thái</span><select name="status" key={project?.status} defaultValue={project?.status ?? 'draft'}><option value="draft">Draft</option><option value="active">Active</option><option value="at_risk">At Risk</option><option value="in_review">In Review</option></select></label>
                <button className="cp-btn" type="submit" disabled={saving}>Lưu</button>
              </form>
              <button className="cp-btn" type="button" disabled={saving || !project || ['completed', 'archived'].includes(project.status)} onClick={() => void closeProject()}>Đóng project</button>
            </section>
          </div>
        </>
      ) : null}

      {activeTab === 'brief' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Brief {latestBrief ? `v${latestBrief.version}` : ''}</h2><span className="cp-pill">{dash(latestBrief?.approval_status)}</span></header>
          <p>{latestBrief ? JSON.stringify(latestBrief.body_json) : dash(null)}</p>
          <form className="cp-filters" onSubmit={addBrief}><label><span>Nội dung brief</span><textarea name="content" rows={3} required /></label><button className="cp-btn cp-btn--primary" disabled={saving} type="submit">Tạo revision</button></form>
        </section>
      ) : null}

      {activeTab === 'deliverables' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Deliverables</h2></header>
          <div className="cp-table-wrap"><table className="cp-table"><thead><tr><th>Loại</th><th>Status</th><th>Owner</th><th>Hạn</th><th>Liên kết</th></tr></thead><tbody>{deliverables.length ? deliverables.map((item) => <tr key={item.id}><td>{item.type}</td><td><span className="cp-pill">{item.status}</span></td><td>{dash(item.owner_staff_id)}</td><td>{formatDate(item.due_at)}</td><td>{item.type === 'human_video' && item.vd_project_id ? <a className="cp-link" href={`/crm/video/${item.vd_project_id}`}>Mở Video SOP</a> : dash(null)}</td></tr>) : <tr><td className="cp-empty" colSpan={5}>{dash(null)}</td></tr>}</tbody></table></div>
          <form className="cp-filters" onSubmit={addDeliverable}><label><span>Loại</span><select name="type"><option value="ai_video">AI video</option><option value="motion">Motion</option><option value="social">Social</option><option value="landing_asset">Landing asset</option><option value="human_video">Human video</option></select></label><label><span>Hạn</span><input name="due_at" type="date" /></label><label><span>VD project ID</span><input name="vd_project_id" /></label><button className="cp-btn cp-btn--primary" disabled={saving} type="submit">Tạo deliverable</button></form>
        </section>
      ) : null}

      {activeTab === 'tasks' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Công việc</h2></header>
          <div className="cp-table-wrap"><table className="cp-table"><thead><tr><th>Việc</th><th>Assignee</th><th>Hạn</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.length ? tasks.map((task) => <tr key={task.id}><td>{task.title}</td><td>{dash(task.assignee_id)}</td><td>{formatDate(task.due_at)}</td><td>{dash(task.priority)}</td><td><span className="cp-pill">{dash(task.status)}</span></td></tr>) : <tr><td className="cp-empty" colSpan={5}>{dash(null)}</td></tr>}</tbody></table></div>
          <form className="cp-filters" onSubmit={addTask}><label><span>Tên việc</span><input name="title" required /></label><label><span>Hạn</span><input name="due_at" type="datetime-local" /></label><label><span>Priority</span><select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label><button className="cp-btn cp-btn--primary" disabled={saving} type="submit">Tạo việc</button></form>
        </section>
      ) : null}

      {activeTab === 'media' ? emptyBody('Media') : null}
      {activeTab === 'approvals' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Phê duyệt</h2></header>
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
              <button
                className="cp-btn cp-btn--primary"
                type="submit"
                disabled={saving || !canSubmitHub}
              >
                Chia sẻ review
              </button>
            </form>
          ) : (
            <>
              <p className="cp-muted">Chưa có version để gửi Hub</p>
              <p className="cp-empty">{dash(null)}</p>
              <button className="cp-btn" type="button" disabled>Chia sẻ review</button>
            </>
          )}
        </section>
      ) : null}
      {activeTab === 'budget' ? emptyBody('Ngân sách') : null}
      {activeTab === 'activity' ? (
        <section className="cp-card"><header className="cp-card__head"><h2>Hoạt động</h2></header>{activity.length ? <ul className="cp-timeline">{activity.map((item) => <li key={item.id}><time>{formatDate(item.created_at)}</time><b>{item.action}</b></li>)}</ul> : <><p className="cp-muted">Chưa có dữ liệu</p><p className="cp-empty">{dash(null)}</p></>}</section>
      ) : null}
    </div>
  );
}

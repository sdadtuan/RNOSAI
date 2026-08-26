'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DetailPageLayout, StaffPageShell } from '@/components/layout';
import {
  Form,
  FormCheck,
  FormField,
  FormFooter,
  FormGrid,
  FormInput,
  FormSelect,
} from '@/components/form';
import {
  fetchB2bProject,
  fetchB2bProjectChannels,
  fetchB2bProjectPages,
  fetchB2bProjectStaff,
  patchB2bProject,
  replaceB2bProjectStaff,
  type B2bProjectChannelRow,
  type B2bProjectDetail,
  type B2bProjectPageRow,
  type B2bProjectStaffRow,
} from '@/lib/b2b-projects-api';
import {
  B2B_PROJECT_STATUSES,
  B2B_PROJECT_STATUS_LABELS,
  b2bProjectStatusBadgeClass,
  labelB2bProjectStatus,
  slaFromJson,
  slaToJson,
  type B2bProjectStatus,
  type B2bSlaForm,
} from '@/lib/b2b-project-util';
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

type DetailTab = 'overview' | 'channels' | 'staff' | 'sla' | 'commission';

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Tổng quan',
  channels: 'Kênh',
  staff: 'Nhân viên',
  sla: 'SLA & gọi',
  commission: 'Hoa hồng',
};

type StaffDraft = { staff_id: string; assign_enabled: boolean; sales_level: string };

export default function CrmB2bProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<B2bProjectDetail | null>(null);
  const [pages, setPages] = useState<B2bProjectPageRow[]>([]);
  const [channels, setChannels] = useState<B2bProjectChannelRow[]>([]);
  const [staff, setStaff] = useState<B2bProjectStaffRow[]>([]);
  const [staffDraft, setStaffDraft] = useState<StaffDraft[]>([]);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<B2bProjectStatus>('draft');
  const [manualIngest, setManualIngest] = useState(true);
  const [aiCall, setAiCall] = useState(false);
  const [slaForm, setSlaForm] = useState<B2bSlaForm>(slaFromJson(undefined));
  const [firstTouchPct, setFirstTouchPct] = useState(30);
  const [closerPct, setCloserPct] = useState(70);

  const canManage = Boolean(user && hasCap(user, 'crm_b2b_projects', 'manage'));

  const loadProject = useCallback(async (access: string) => {
    const [detail, pageRows, channelRows, staffRows] = await Promise.all([
      fetchB2bProject(access, projectId),
      fetchB2bProjectPages(access, projectId),
      fetchB2bProjectChannels(access, projectId),
      fetchB2bProjectStaff(access, projectId),
    ]);
    setProject(detail);
    setPages(pageRows);
    setChannels(channelRows);
    setStaff(staffRows);
    setStaffDraft(
      staffRows.map((s) => ({
        staff_id: String(s.staff_id),
        assign_enabled: s.assign_enabled,
        sales_level: s.sales_level,
      })),
    );
    setName(detail.name);
    setStatus((detail.status as B2bProjectStatus) ?? 'draft');
    setManualIngest(Boolean(detail.manual_ingest_enabled));
    setAiCall(Boolean(detail.ai_call_enabled));
    setSlaForm(slaFromJson(detail.sla_json));
    setFirstTouchPct(detail.commission_json?.first_touch_pct ?? 30);
    setCloserPct(detail.commission_json?.closer_pct ?? 70);
  }, [projectId]);

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
      if (!hasCap(me, 'crm_b2b_projects', 'view')) {
        setError('Không có quyền');
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

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        await loadProject(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadProject, projectId]);

  async function saveOverview(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const updated = await patchB2bProject(access, projectId, {
        name: name.trim(),
        status,
        manual_ingest_enabled: manualIngest,
        ai_call_enabled: aiCall,
      });
      setProject(updated);
      setMsg('Đã lưu cài đặt dự án.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function saveSla(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const updated = await patchB2bProject(access, projectId, { sla_json: slaToJson(slaForm) });
      setProject(updated);
      setMsg('Đã lưu SLA.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu SLA thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function saveCommission(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const updated = await patchB2bProject(access, projectId, {
        commission_json: { first_touch_pct: firstTouchPct, closer_pct: closerPct },
      });
      setProject(updated);
      setMsg('Đã lưu hoa hồng.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu hoa hồng thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const payload = staffDraft
        .filter((s) => s.staff_id.trim())
        .map((s) => ({
          staff_id: Number(s.staff_id),
          assign_enabled: s.assign_enabled,
          sales_level: s.sales_level,
        }))
        .filter((s) => Number.isFinite(s.staff_id) && s.staff_id > 0);
      await replaceB2bProjectStaff(access, projectId, payload);
      await loadProject(access);
      setMsg('Đã lưu pool nhân viên.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu nhân viên thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatusQuick() {
    if (!project || !canManage) return;
    const next: B2bProjectStatus = project.status === 'active' ? 'paused' : 'active';
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const updated = await patchB2bProject(access, projectId, { status: next });
      setProject(updated);
      setStatus(next);
      setMsg(next === 'paused' ? 'Đã tạm dừng dự án.' : 'Đã kích hoạt dự án.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  function slaBandField(
    label: string,
    band: keyof Pick<B2bSlaForm, 'hot' | 'warm' | 'cold'>,
    field: 'warnMin' | 'hopMin',
  ) {
    return (
      <FormField label={`${label} — ${field === 'warnMin' ? 'Cảnh báo (phút)' : 'Chuyển NV (phút)'}`}>
        <FormInput
          type="number"
          min={1}
          disabled={!canManage || saving}
          value={slaForm[band][field] ?? ''}
          onChange={(e) =>
            setSlaForm((prev) => ({
              ...prev,
              [band]: { ...prev[band], [field]: Number(e.target.value) || undefined },
            }))
          }
        />
      </FormField>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Dự án PTT', href: '/crm/b2b-projects' },
        { label: project?.name ?? projectId },
      ]}
    >
      <DetailPageLayout
        title={project?.name ?? 'Dự án PTT'}
        subtitle={project ? `${project.code}` : undefined}
        backHref="/crm/b2b-projects"
        backLabel="← Danh sách"
        actions={
          project && canManage ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {project.status === 'active' ? (
                <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => void toggleStatusQuick()}>
                  Dừng dự án
                </button>
              ) : project.status === 'paused' || project.status === 'draft' ? (
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void toggleStatusQuick()}>
                  Kích hoạt
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {project ? (
          <p style={{ marginTop: 0 }}>
            <span className={b2bProjectStatusBadgeClass(project.status)}>{labelB2bProjectStatus(project.status)}</span>
          </p>
        ) : null}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        {project ? (
          <>
            <div className="lead-b2b-subtabs" role="tablist" aria-label="Chi tiết dự án PTT">
              {(Object.keys(TAB_LABELS) as DetailTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={tab === key ? 'is-active' : ''}
                  onClick={() => setTab(key)}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <Form className="stack-gap" onSubmit={(e) => void saveOverview(e)}>
                <p className="muted">Chủ quản: PTT</p>
                <FormGrid cols={2}>
                  <FormField label="Mã webhook">
                    <FormInput value={project.code} disabled readOnly />
                  </FormField>
                  <FormField label="Tên dự án">
                    <FormInput value={name} disabled={!canManage || saving} onChange={(e) => setName(e.target.value)} required />
                  </FormField>
                  <FormField label="Trạng thái">
                    <FormSelect value={status} disabled={!canManage || saving} onChange={(e) => setStatus(e.target.value as B2bProjectStatus)}>
                      {B2B_PROJECT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {B2B_PROJECT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                </FormGrid>
                <FormCheck label="Ingest lead thủ công">
                  <input type="checkbox" checked={manualIngest} disabled={!canManage || saving} onChange={(e) => setManualIngest(e.target.checked)} />
                </FormCheck>
                <FormCheck label="AI gọi (pilot)">
                  <input type="checkbox" checked={aiCall} disabled={!canManage || saving} onChange={(e) => setAiCall(e.target.checked)} />
                </FormCheck>
                <p className="muted">
                  Webhook Meta: <code>/api/v1/webhooks/meta/{project.code}</code>
                  <br />
                  Webhook Zalo: <code>/api/v1/webhooks/zalo/{project.code}</code>
                </p>
                {canManage ? (
                  <FormFooter>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
                    </button>
                  </FormFooter>
                ) : null}
              </Form>
            ) : null}

            {tab === 'channels' ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <section>
                  <h3 style={{ marginTop: 0 }}>Facebook pages & forms</h3>
                  {pages.length === 0 ? (
                    <p className="muted">Chưa cấu hình page/form.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {pages.map((p) => (
                        <li key={p.id}>
                          <strong>{p.page_id}</strong>
                          {p.name ? ` — ${p.name}` : ''}{' '}
                          <span className="muted">{p.active ? 'active' : 'inactive'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3>Zalo / Webform / API</h3>
                  {channels.length === 0 ? (
                    <p className="muted">Chưa cấu hình kênh.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {channels.map((c) => (
                        <li key={c.id}>
                          {c.channel_type}: <code>{c.external_key}</code>
                          {c.label ? ` — ${c.label}` : ''}{' '}
                          <span className="muted">{c.active ? 'active' : 'inactive'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <p className="muted">Cấu hình kênh chi tiết qua API hoặc liên hệ IT (UI kênh sẽ bổ sung sau).</p>
              </div>
            ) : null}

            {tab === 'staff' ? (
              <Form className="stack-gap" onSubmit={(e) => void saveStaff(e)}>
                <p className="muted">Pool nhân viên nhận lead tự động cho dự án này.</p>
                {staffDraft.map((row, idx) => (
                  <FormGrid cols={3} key={`staff-${idx}`}>
                    <FormField label="Staff ID">
                      <FormInput
                        value={row.staff_id}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setStaffDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, staff_id: e.target.value } : r)))
                        }
                      />
                    </FormField>
                    <FormField label="Cấp">
                      <FormSelect
                        value={row.sales_level}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setStaffDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, sales_level: e.target.value } : r)))
                        }
                      >
                        {['s', 'a', 'b', 'c'].map((lv) => (
                          <option key={lv} value={lv}>
                            {lv.toUpperCase()}
                          </option>
                        ))}
                      </FormSelect>
                    </FormField>
                    <FormField label="Nhận lead">
                      <FormSelect
                        value={row.assign_enabled ? 'yes' : 'no'}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setStaffDraft((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, assign_enabled: e.target.value === 'yes' } : r)),
                          )
                        }
                      >
                        <option value="yes">Có</option>
                        <option value="no">Không</option>
                      </FormSelect>
                    </FormField>
                  </FormGrid>
                ))}
                {canManage ? (
                  <FormFooter>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={saving}
                      onClick={() => setStaffDraft((prev) => [...prev, { staff_id: '', assign_enabled: true, sales_level: 'b' }])}
                    >
                      + Thêm NV
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Đang lưu…' : 'Lưu pool NV'}
                    </button>
                  </FormFooter>
                ) : null}
                {staff.length === 0 && !canManage ? <p className="muted">Chưa gán nhân viên.</p> : null}
              </Form>
            ) : null}

            {tab === 'sla' ? (
              <Form className="stack-gap" onSubmit={(e) => void saveSla(e)}>
                <FormGrid cols={2}>
                  {slaBandField('Hot', 'hot', 'warnMin')}
                  {slaBandField('Hot', 'hot', 'hopMin')}
                  {slaBandField('Warm', 'warm', 'warnMin')}
                  {slaBandField('Warm', 'warm', 'hopMin')}
                  {slaBandField('Cold', 'cold', 'warnMin')}
                  {slaBandField('Cold', 'cold', 'hopMin')}
                  <FormField label="Số lần chuyển NV tối đa">
                    <FormInput
                      type="number"
                      min={0}
                      disabled={!canManage || saving}
                      value={slaForm.maxHops}
                      onChange={(e) => setSlaForm((prev) => ({ ...prev, maxHops: Number(e.target.value) || 0 }))}
                    />
                  </FormField>
                </FormGrid>
                {canManage ? (
                  <FormFooter>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Đang lưu…' : 'Lưu SLA'}
                    </button>
                  </FormFooter>
                ) : null}
              </Form>
            ) : null}

            {tab === 'commission' ? (
              <Form className="stack-gap" onSubmit={(e) => void saveCommission(e)}>
                <FormGrid cols={2}>
                  <FormField label="First-touch (%)">
                    <FormInput
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canManage || saving}
                      value={firstTouchPct}
                      onChange={(e) => setFirstTouchPct(Number(e.target.value) || 0)}
                    />
                  </FormField>
                  <FormField label="Closer (%)">
                    <FormInput
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canManage || saving}
                      value={closerPct}
                      onChange={(e) => setCloserPct(Number(e.target.value) || 0)}
                    />
                  </FormField>
                </FormGrid>
                {canManage ? (
                  <FormFooter>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Đang lưu…' : 'Lưu hoa hồng'}
                    </button>
                  </FormFooter>
                ) : null}
              </Form>
            ) : null}
          </>
        ) : null}
      </DetailPageLayout>
    </StaffPageShell>
  );
}

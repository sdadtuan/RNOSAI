'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DetailPageLayout, StaffPageShell } from '@/components/layout';
import {
  ApiError,
  createLead,
  fetchAgencyClients,
  fetchCrmStaffList,
  fetchLeadB2bProjectOptions,
  fetchLeadLookupOptions,
  staffMe,
  staffRefresh,
  type AgencyClient,
  type CrmLeadLookupOption,
  type CrmStaffRow,
} from '@/lib/api';
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
  leadsListHref,
  type CrmLeadsFlowScope,
} from '@/lib/crm/lead-flow-routes';
import { statusOptionsForFlowKind } from '@/lib/crm/lead-flow-kind';

const SPA_STATUS_OPTIONS = [
  { value: 'moi', label: 'Mới' },
  { value: 'da_lien_he', label: 'Đã liên hệ' },
  { value: 'dang_tu_van', label: 'Đang tư vấn' },
  { value: 'hen_gap', label: 'Hẹn gặp' },
  { value: 'chot', label: 'Chốt' },
  { value: 'lost', label: 'Lost' },
] as const;

function flowScopeFromPathname(pathname: string): CrmLeadsFlowScope {
  if (pathname.startsWith('/crm/operational/leads') || pathname.startsWith('/crm/spa/leads')) {
    return 'spa_operational';
  }
  if (pathname.startsWith('/crm/b2b/leads')) return 'b2b_prospect';
  return 'all';
}

export function CrmNewLeadPageContent({
  flowScope: flowScopeProp,
}: {
  flowScope?: CrmLeadsFlowScope;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const flowScope = flowScopeProp ?? flowScopeFromPathname(pathname);
  const isOperationalFlow = flowScope === 'spa_operational';
  const isB2bFlow = flowScope === 'b2b_prospect';
  const listHref = leadsListHref(flowScope);
  const pageTitle = isOperationalFlow
    ? 'Tạo lead CSKH vận hành'
    : isB2bFlow
      ? 'Tạo lead B2B'
      : 'Tạo lead thủ công';
  const statusOptions = useMemo(() => {
    if (isOperationalFlow) return SPA_STATUS_OPTIONS;
    if (isB2bFlow) {
      return statusOptionsForFlowKind('b2b_prospect').map((value) => ({
        value,
        label: value,
      }));
    }
    return SPA_STATUS_OPTIONS;
  }, [isB2bFlow, isOperationalFlow]);
  const [presetClientId, setPresetClientId] = useState('');
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [sourceOptions, setSourceOptions] = useState<CrmLeadLookupOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<CrmLeadLookupOption[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('manual');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('moi');
  const [ownerId, setOwnerId] = useState('');
  const [b2bProjectId, setB2bProjectId] = useState('');
  const [b2bProjects, setB2bProjects] = useState<
    Array<{ id: string; code: string; name: string; status: string }>
  >([]);
  const [b2bProjectsHint, setB2bProjectsHint] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);
  /** Admin / CEO (gdkd.view_all_leads): mọi agency, mọi dự án, gán owner tự do. */
  const canAssignAnyOwner = useMemo(
    () =>
      Boolean(
        user &&
          (String(user.position_code ?? '').toLowerCase() === 'super-admin' ||
            hasCap(user, 'crm_gdkd', 'view_all_leads')),
      ),
    [user],
  );
  const lockOwnerToSelf = isB2bFlow && !canAssignAnyOwner;
  const ownerChoices = useMemo(() => {
    const active = staffOptions.filter((s) => s.active !== 0);
    if (!canAssignAnyOwner) {
      const myEmail = (user?.email ?? '').trim().toLowerCase();
      return active.filter((s) => s.email.trim().toLowerCase() === myEmail);
    }
    return active.filter((s) => s.can_receive_leads !== false);
  }, [staffOptions, canAssignAnyOwner, user?.email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clientId = new URLSearchParams(window.location.search).get('client_id') ?? '';
    setPresetClientId(clientId);
  }, []);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    const cached = getStoredUser();
    if (cached) setUser(cached);

    void (async () => {
      let currentToken = access;
      let me: StoredStaffUser | null = null;
      try {
        me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'crm_leads', 'edit')) {
          setError('Không có quyền tạo lead');
          return;
        }
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        currentToken = out.access_token;
        setToken(currentToken);
        me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
      }

      const assignAny =
        Boolean(me) &&
        (String(me?.position_code ?? '').toLowerCase() === 'super-admin' ||
          hasCap(me, 'crm_gdkd', 'view_all_leads'));

      const [clientOut, staffOut, sourceOut, channelOut] = await Promise.all([
        fetchAgencyClients(currentToken, {
          mine: (isB2bFlow || isOperationalFlow) && !assignAny,
        }).catch(() => ({ clients: [] as AgencyClient[] })),
        fetchCrmStaffList(currentToken).catch(() => ({ staff: [] as CrmStaffRow[], summary: {} })),
        fetchLeadLookupOptions(currentToken, 'source').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
        fetchLeadLookupOptions(currentToken, 'channel').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
      ]);
      setClients(clientOut.clients ?? []);
      const staff = staffOut.staff ?? [];
      setStaffOptions(staff);
      // Owner = crm_staff.id (bigint), not staff_users UUID.
      const myEmail = (me?.email ?? '').trim().toLowerCase();
      const selfStaff =
        staff.find((s) => s.email.trim().toLowerCase() === myEmail && s.active !== 0) ??
        staff.find((s) => s.email.trim().toLowerCase() === myEmail);
      if (selfStaff) {
        setOwnerId(String(selfStaff.id));
      }
      const sources = sourceOut.options ?? [];
      const channels = channelOut.options ?? [];
      setSourceOptions(sources);
      setChannelOptions(channels);
      setSource((prev) => {
        if (sources.some((opt) => opt.option_key === prev)) return prev;
        const manual = sources.find((opt) => opt.option_key === 'manual');
        return manual?.option_key ?? sources[0]?.option_key ?? 'manual';
      });
      if (presetClientId) {
        setClientId(presetClientId);
      }
      if (isB2bFlow) {
        try {
          const projects = await fetchLeadB2bProjectOptions(currentToken, 'active');
          setB2bProjects(projects);
          setB2bProjectsHint(
            projects.length === 0
              ? assignAny
                ? 'Chưa có dự án PTT active — tạo tại /crm/b2b-projects.'
                : 'Chưa có dự án PTT bạn đang tham gia — nhờ admin thêm bạn vào staff dự án tại /crm/b2b-projects.'
              : '',
          );
          if (projects.length === 1) setB2bProjectId(projects[0].id);
        } catch {
          setB2bProjects([]);
          setB2bProjectsHint('Không tải được danh sách dự án PTT. Thử lại hoặc liên hệ admin.');
        }
      }
    })();
  }, [presetClientId, router, isB2bFlow, isOperationalFlow]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !user || !canCreate) return;
    if (!fullName.trim()) {
      setError('Họ tên là bắt buộc');
      return;
    }
    if (isOperationalFlow && !clientId) {
      setError('Chọn khách hàng agency (client) — bắt buộc với lead CSKH vận hành');
      return;
    }
    if (isB2bFlow && !b2bProjectId.trim()) {
      setError(
        b2bProjects.length === 0
          ? b2bProjectsHint || 'Thiếu dự án PTT — bắt buộc với lead B2B'
          : 'Chọn dự án PTT — bắt buộc với lead B2B',
      );
      return;
    }
    if (canAssignAnyOwner && !(ownerId && Number.isFinite(Number(ownerId)))) {
      setError('Chọn Owner (nhân viên được nhận lead)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lead = await createLead(access, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        client_id: clientId || undefined,
        source: source.trim() || 'manual',
        channel: channel.trim() || undefined,
        status,
        owner_id: ownerId && Number.isFinite(Number(ownerId)) ? Number(ownerId) : undefined,
        lead_flow_kind: isOperationalFlow ? 'spa_operational' : isB2bFlow ? 'b2b_prospect' : undefined,
        b2b_project_id: isB2bFlow && b2bProjectId ? b2bProjectId : undefined,
      });
      router.push(`/crm/leads/${lead.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          'Không ghi được lead — kiểm tra PTT_LEADS_WRITE_ENABLED=1 trên API (ptt-crm-api).',
        );
      } else if (
        err instanceof ApiError &&
        (err.message === 'b2b_project_required' || String(err.message).includes('b2b_project_required'))
      ) {
        setError('Thiếu dự án PTT — chọn Dự án PTT trước khi tạo lead B2B.');
      } else {
        setError(err instanceof Error ? err.message : 'Tạo lead thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: listHref },
        { label: 'Leads', href: listHref },
        { label: pageTitle },
      ]}
    >
      <DetailPageLayout
        title={pageTitle}
        backHref={listHref}
        backLabel="← Danh sách"
      >
        {!canCreate ? (
          <p className="error">Không có quyền tạo lead (crm_leads · edit).</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Họ tên *</span>
              <input
                className="kpi-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>SĐT</span>
                <input
                  className="kpi-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Email</span>
                <input
                  className="kpi-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>{isOperationalFlow ? 'Khách hàng agency *' : 'Khách hàng agency (tuỳ chọn)'}</span>
              <select
                className="kpi-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required={isOperationalFlow}
              >
                <option value="">{isB2bFlow ? '— Không gắn client (B2B) —' : '— Chọn client —'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.code} · {client.name}
                  </option>
                ))}
              </select>
              {(isB2bFlow || isOperationalFlow) && clients.length === 0 ? (
                <span className="muted">
                  {canAssignAnyOwner
                    ? 'Chưa có khách hàng agency trong hệ thống.'
                    : 'Chỉ hiện khách hàng agency bạn phụ trách (chưa có binding — nhờ admin gán client).'}
                </span>
              ) : null}
            </label>

            {isB2bFlow ? (
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Dự án PTT *</span>
                <select
                  className="kpi-select"
                  value={b2bProjectId}
                  onChange={(e) => setB2bProjectId(e.target.value)}
                  required
                  disabled={b2bProjects.length === 0}
                >
                  <option value="">
                    {b2bProjects.length === 0 ? '— Chưa có dự án —' : '— Chọn dự án —'}
                  </option>
                  {b2bProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                {b2bProjectsHint ? <span className="muted">{b2bProjectsHint}</span> : null}
              </label>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Nguồn</span>
                <select
                  className="kpi-select"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {sourceOptions.length === 0 ? (
                    <option value="manual">manual</option>
                  ) : (
                    sourceOptions.map((opt) => (
                      <option key={opt.id} value={opt.option_key}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Kênh</span>
                <select
                  className="kpi-select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="">— Chọn kênh —</option>
                  {channelOptions.map((opt) => (
                    <option key={opt.id} value={opt.option_key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Trạng thái</span>
                <select
                  className="kpi-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Owner</span>
                <select
                  className="kpi-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  disabled={lockOwnerToSelf}
                  title={
                    lockOwnerToSelf
                      ? 'Lead B2B tạo tay luôn gán cho bạn'
                      : canAssignAnyOwner
                        ? 'Chọn nhân viên đang bật nhận lead'
                        : undefined
                  }
                >
                  {canAssignAnyOwner ? <option value="">— Chọn owner —</option> : null}
                  {!canAssignAnyOwner ? <option value="">— Chưa gán —</option> : null}
                  {ownerChoices.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                      {staff.can_receive_leads === false ? ' (không nhận lead)' : ''}
                    </option>
                  ))}
                </select>
                {lockOwnerToSelf ? (
                  <span className="muted">Tự gán cho bạn khi tạo lead B2B.</span>
                ) : canAssignAnyOwner ? (
                  <span className="muted">Admin/CEO: gán cho NV đang bật nhận lead.</span>
                ) : null}
              </label>
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" disabled={saving || !token}>
                {saving ? 'Đang tạo…' : 'Tạo lead'}
              </button>
              <Link href={listHref} className="btn btn-secondary">
                Hủy
              </Link>
            </div>
          </form>
        )}
      </DetailPageLayout>
    </StaffPageShell>
  );
}

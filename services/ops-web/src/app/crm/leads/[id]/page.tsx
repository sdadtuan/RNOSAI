'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadB2bSalesFlowBar, type LeadContractFlowSummary } from '@/components/LeadB2bSalesFlowBar';
import { LeadAttributionChips } from '@/components/crm/LeadAttributionChips';
import { LeadContractPanel } from '@/components/LeadContractPanel';
import { LeadCopilotPanel } from '@/components/ai/LeadCopilotPanel';
import { LeadEntityTimelinePanel } from '@/components/crm/LeadEntityTimelinePanel';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import {
  assignLead,
  createLeadActivity,
  fetchCatalogBundle,
  fetchLead,
  fetchLeadActivities,
  fetchLeadAttribution,
  fetchLeadAudit,
  patchLeadLegacy,
  staffMe,
  staffRefresh,
  type CatalogStaffOption,
  type CatalogServiceRow,
  type LeadActivityRow,
  type LeadAssignmentLogRow,
  type LeadAttributionData,
  type LeadAuditBundle,
  type LeadFunnelSnapshot,
  type LeadRow,
  type LeadStatusLogRow,
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

const STATUS_OPTIONS = [
  'moi',
  'da_lien_he',
  'dang_tu_van',
  'hen_gap',
  'bao_gia',
  'dam_phan',
  'chot',
  'post_sale',
  'lost',
  'pending_cleanup',
];

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Ghi chú' },
  { value: 'call', label: 'Gọi điện' },
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Tin nhắn' },
  { value: 'meeting', label: 'Họp' },
  { value: 'proposal', label: 'Báo giá' },
  { value: 'task', label: 'Công việc' },
  { value: 'reminder', label: 'Nhắc việc' },
];

type LeadDetailTab = 'detail' | 'activity' | 'ai';

function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '';
}

async function copyLeadContact(value: string, label: string, onDone: (msg: string) => void) {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    await navigator.clipboard.writeText(trimmed);
    onDone(`Đã copy ${label} vào clipboard.`);
  } catch {
    onDone(`Không copy được ${label}.`);
  }
}

function useLeadDetailLayout() {
  const [layout, setLayout] = useState({ desktop: false, tablet: false, mobile: true });

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 1280px)');
    const mqTablet = window.matchMedia('(min-width: 1024px)');

    const sync = () => {
      const w = window.innerWidth;
      setLayout({
        desktop: w >= 1280,
        tablet: w >= 1024 && w < 1280,
        mobile: w < 1024,
      });
    };

    sync();
    mqDesktop.addEventListener('change', sync);
    mqTablet.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mqDesktop.removeEventListener('change', sync);
      mqTablet.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return layout;
}

function useNetworkOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}

export default function CrmLeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = Number(params.id);
  const presetServiceSlug = searchParams.get('service_slug')?.trim() || undefined;

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [attribution, setAttribution] = useState<LeadAttributionData | null>(null);
  const [staffOptions, setStaffOptions] = useState<CatalogStaffOption[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceRow[]>([]);
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [audit, setAudit] = useState<LeadAuditBundle | null>(null);
  const [status, setStatus] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [assignToId, setAssignToId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activityContent, setActivityContent] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeadDetailTab>('detail');
  const [copilotMessage, setCopilotMessage] = useState('');
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
  const [contractSummary, setContractSummary] = useState<LeadContractFlowSummary | null>(null);
  const [contractRefresh, setContractRefresh] = useState(0);
  const layout = useLeadDetailLayout();
  const online = useNetworkOnline();
  const copilotOn = aiCopilotEnabled();

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
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem CRM leads');
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

  const reloadTimeline = useCallback(async (access: string) => {
    const [acts, aud] = await Promise.all([
      fetchLeadActivities(access, leadId),
      fetchLeadAudit(access, leadId),
    ]);
    setActivities(acts);
    setAudit(aud);
  }, [leadId]);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setError('Lead ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const [row, catalog, attr] = await Promise.all([
          fetchLead(access, leadId),
          fetchCatalogBundle(access).catch(() => null),
          fetchLeadAttribution(access, leadId).catch(() => null),
        ]);
        setLead(row);
        setAttribution(attr);
        setStatus(row.status || 'moi');
        if (catalog?.staff?.length) {
          setStaffOptions(catalog.staff);
        }
        if (catalog?.services?.length) {
          setCatalogServices(catalog.services.filter((service) => service.active));
        }
        await reloadTimeline(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải lead thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, leadId, reloadTimeline]);

  async function onSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền sửa trạng thái');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    if (status.trim() === lead.status) {
      setMessage('Trạng thái không đổi');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchLeadLegacy(access, leadId, {
        status: status.trim(),
        audit_note: auditNote.trim(),
      });
      setLead(updated);
      setStatus(updated.status || status);
      setAuditNote('');
      setMessage('Đã lưu trạng thái + audit SQLite');
      await reloadTimeline(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'assign')) {
      setError('Không có quyền phân lead');
      return;
    }
    const toId = Number(assignToId);
    const reason = assignReason.trim();
    if (!Number.isFinite(toId) || toId <= 0) {
      setError('Chọn nhân viên nhận lead');
      return;
    }
    if (reason.length < 3) {
      setError('Cần ghi lý do phân lại (≥ 3 ký tự)');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAssigning(true);
    setError('');
    setMessage('');
    try {
      const updated = await assignLead(access, leadId, { to_user_id: toId, reason });
      setLead(updated);
      setAssignToId('');
      setAssignReason('');
      setMessage('Đã phân lead');
      await reloadTimeline(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân lead thất bại');
    } finally {
      setAssigning(false);
    }
  }

  async function onAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền thêm hoạt động');
      return;
    }
    const content = activityContent.trim();
    if (!content) {
      setError('Nội dung hoạt động không được trống');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAddingActivity(true);
    setError('');
    setMessage('');
    try {
      await createLeadActivity(access, leadId, {
        activity_type: activityType,
        content,
      });
      setActivityContent('');
      setMessage('Đã thêm hoạt động');
      await reloadTimeline(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm hoạt động thất bại');
    } finally {
      setAddingActivity(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  const accessToken = getAccessToken();
  const useMobileTabs = layout.mobile && copilotOn;
  const showCopilotInline =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.desktop;
  const showCopilotSheet =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.mobile && mobileTab === 'ai';
  const showCopilotDrawer =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.tablet && copilotDrawerOpen;
  const hideDetailPane = useMobileTabs && mobileTab === 'activity';
  const hideTimelinePane = useMobileTabs && mobileTab !== 'activity';

  function renderCopilotPanel(variant: 'column' | 'drawer' | 'sheet', onCloseDrawer?: () => void) {
    if (!online) {
      return (
        <div
          className="lead-copilot-offline-banner"
          role="alert"
          data-testid="copilot-offline-banner"
        >
          Copilot cần kết nối mạng
        </div>
      );
    }
    if (!lead || !user || !accessToken) return null;
    return (
      <LeadCopilotPanel
        token={accessToken}
        leadId={leadId}
        lead={lead}
        user={user}
        activities={activities}
        selectedActivityId={selectedActivityId}
        onSelectActivity={setSelectedActivityId}
        onCopilotError={setCopilotMessage}
        onActivityCreated={() => {
          const access = getAccessToken();
          if (access) void reloadTimeline(access);
        }}
        variant={variant}
        onCloseDrawer={onCloseDrawer}
      />
    );
  }

  const fieldStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.55rem 0.75rem',
    color: 'var(--text)',
  } as const;

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: lead?.full_name || `#${leadId}` },
      ]}
    >
      <p className="detail-page-back">
        <Link href="/crm/leads" className="btn btn-sm btn-ghost">
          ← Danh sách leads
        </Link>
      </p>
      <PageToolbar
        title={lead?.full_name || `Lead #${leadId}`}
        subtitle={lead?.phone ? `${lead.phone} · ${lead.status ?? '—'}` : undefined}
      />

      <div className={`lead-detail-page${showCopilotSheet ? ' lead-detail-page--copilot-sheet' : ''}`}>

      {layout.mobile && copilotOn ? (
        <div className="lead-detail-tabs" role="tablist" aria-label="Lead detail sections">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'detail'}
            className={mobileTab === 'detail' ? 'is-active' : ''}
            onClick={() => setMobileTab('detail')}
          >
            Chi tiết
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'activity'}
            className={mobileTab === 'activity' ? 'is-active' : ''}
            onClick={() => setMobileTab('activity')}
          >
            Hoạt động
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'ai'}
            className={mobileTab === 'ai' ? 'is-active' : ''}
            onClick={() => setMobileTab('ai')}
          >
            AI
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">Đang tải lead #{leadId}…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}
      {copilotMessage ? <p className="muted">{copilotMessage}</p> : null}

      {lead && !loading ? (
        <div className="lead-detail-layout">
          <div
            className={`lead-detail-main ${hideDetailPane ? 'lead-detail-pane--hidden' : ''}`}
          >
            <div className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>
                #{lead.id} · {lead.full_name || '—'}
              </h2>
              <LeadAttributionChips attribution={attribution} />
              <LeadB2bSalesFlowBar leadId={leadId} funnel={funnelSnap} contract={contractSummary} />
              <dl className="lead-detail-dl">
                <dt className="muted">SĐT</dt>
                <dd>
                  {lead.phone || '—'}
                  {lead.phone ? (
                    <span
                      className="lead-contact-copy"
                      style={{ marginLeft: '0.5rem', display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}
                      data-testid="lead-contact-copy"
                    >
                      <a
                        href={phoneTelHref(lead.phone)}
                        className="btn btn-secondary btn-sm"
                        data-testid="lead-contact-call"
                      >
                        Gọi
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void copyLeadContact(lead.phone, 'SĐT', setMessage)}
                      >
                        Copy SĐT
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void copyLeadContact(lead.phone, 'Zalo', setMessage)}
                        title="Copy SĐT để dán thủ công trên Zalo — không gửi tự động"
                      >
                        Copy Zalo
                      </button>
                    </span>
                  ) : null}
                </dd>
                <dt className="muted">Email</dt>
                <dd>{lead.email || '—'}</dd>
                <dt className="muted">Nguồn</dt>
                <dd>{lead.source || '—'}</dd>
                <dt className="muted">Owner</dt>
                <dd>{lead.owner_id ?? '—'}</dd>
                <dt className="muted">Ngày</dt>
                <dd>{lead.created_at?.slice(0, 10) ?? '—'}</dd>
              </dl>

              {accessToken ? (
                <LeadFunnelPanel
                  token={accessToken}
                  leadId={leadId}
                  user={user}
                  serviceSlug={presetServiceSlug}
                  serviceOptions={catalogServices.map((service) => ({
                    slug: service.slug,
                    name: service.name,
                  }))}
                  onMessage={setMessage}
                  onError={setError}
                  onFunnelChange={setFunnelSnap}
                  onFunnelUpdated={() => setContractRefresh((n) => n + 1)}
                />
              ) : null}

              {accessToken ? (
                <LeadContractPanel
                  token={accessToken}
                  leadId={leadId}
                  user={user}
                  refreshToken={contractRefresh}
                  onMessage={setMessage}
                  onError={setError}
                  onLoaded={setContractSummary}
                />
              ) : null}

              <form onSubmit={(e) => void onSaveStatus(e)} style={{ display: 'grid', gap: '0.85rem', marginTop: '1rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Trạng thái</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={!hasCap(user, 'crm_leads', 'edit') || saving}
                    style={fieldStyle}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Ghi chú audit (tùy chọn)</span>
                  <input
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    placeholder="Lý do đổi trạng thái"
                    disabled={!hasCap(user, 'crm_leads', 'edit') || saving}
                    style={fieldStyle}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={saving || !hasCap(user, 'crm_leads', 'edit')}
                >
                  {saving ? 'Đang lưu…' : 'Lưu trạng thái'}
                </button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Phân lead</h3>
              <form onSubmit={(e) => void onAssign(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Nhân viên</span>
                  <select
                    value={assignToId}
                    onChange={(e) => setAssignToId(e.target.value)}
                    disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                    style={fieldStyle}
                  >
                    <option value="">— Chọn —</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} (#{s.id})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Lý do</span>
                  <input
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    placeholder="Bắt buộc"
                    disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                    style={fieldStyle}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={assigning || !hasCap(user, 'crm_leads', 'assign')}
                >
                  {assigning ? 'Đang phân…' : 'Phân lead'}
                </button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Thêm hoạt động</h3>
              <form onSubmit={(e) => void onAddActivity(e)} style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Loại</span>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                    style={fieldStyle}
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="muted">Nội dung</span>
                  <textarea
                    value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    rows={3}
                    disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                    style={{ ...fieldStyle, resize: 'vertical' }}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={addingActivity || !hasCap(user, 'crm_leads', 'edit')}
                >
                  {addingActivity ? 'Đang thêm…' : 'Thêm hoạt động'}
                </button>
              </form>
            </div>
          </div>

          <div
            className={`lead-detail-timeline ${hideTimelinePane ? 'lead-detail-pane--hidden' : ''}`}
          >
            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Timeline hoạt động</h3>
              {activities.length === 0 ? (
                <p className="muted">Chưa có hoạt động.</p>
              ) : (
                <ul className="lead-activity-list">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className={`lead-activity-item ${selectedActivityId === a.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedActivityId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedActivityId(a.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedActivityId === a.id}
                    >
                      <div style={{ fontSize: '0.85rem' }} className="muted">
                        {a.created_at?.slice(0, 16)} · {a.activity_type_label || a.activity_type}
                        {a.user_name ? ` · ${a.user_name}` : ''}
                      </div>
                      <div>{a.content || '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                Chọn activity để tóm tắt trong AI Copilot.
              </p>
            </div>

            {accessToken ? <LeadEntityTimelinePanel token={accessToken} leadId={leadId} /> : null}

            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Audit</h3>
              <AuditSection audit={audit} />
            </div>
          </div>

          {showCopilotInline ? renderCopilotPanel('column') : null}
        </div>
      ) : null}

      {showCopilotSheet ? (
        <>
          <div
            className="lead-copilot-backdrop lead-copilot-backdrop--sheet"
            role="presentation"
            onClick={() => setMobileTab('detail')}
          />
          {renderCopilotPanel('sheet', () => setMobileTab('detail'))}
        </>
      ) : null}

      {showCopilotDrawer ? (
        <>
          <div
            className="lead-copilot-backdrop"
            role="presentation"
            onClick={() => setCopilotDrawerOpen(false)}
          />
          {renderCopilotPanel('drawer', () => setCopilotDrawerOpen(false))}
        </>
      ) : null}

      {layout.tablet && copilotOn && lead && !loading && !copilotDrawerOpen ? (
        <button
          type="button"
          className="lead-copilot-fab"
          onClick={() => setCopilotDrawerOpen(true)}
          aria-label="Mở AI Copilot"
        >
          AI Copilot
        </button>
      ) : null}
      </div>
    </StaffPageShell>
  );
}

function AuditSection({ audit }: { audit: LeadAuditBundle | null }) {
  if (!audit) return <p className="muted">Đang tải audit…</p>;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Trạng thái</h4>
        {audit.status_logs.length === 0 ? (
          <p className="muted">Chưa có log.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {audit.status_logs.map((l: LeadStatusLogRow) => (
              <li key={l.id} style={{ marginBottom: '0.35rem' }}>
                {l.created_at?.slice(0, 16)} · {l.old_status} → {l.new_status}
                {l.note ? ` — ${l.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Phân công</h4>
        {audit.assignment_logs.length === 0 ? (
          <p className="muted">Chưa có log.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {audit.assignment_logs.map((l: LeadAssignmentLogRow) => (
              <li key={l.id} style={{ marginBottom: '0.35rem' }}>
                {l.created_at?.slice(0, 16)} · {l.from_name} → {l.to_name}
                {l.reason ? ` — ${l.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { DetailPageLayout } from '@/components/layout';
import { GrowthSectionsPanel } from '@/components/crm/GrowthSectionsPanel';
import { InsertInsightPlanPanel } from '@/components/research/InsertInsightPlanPanel';
import { fetchMarketingPlanDetail, patchMarketingPlan, staffMe, staffRefresh } from '@/lib/api';
import { fetchRoleKpiSummary } from '@/lib/kpi-hub-api';
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

export default function CrmMarketingPlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const planId = Number(params.id);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewKpiCount, setReviewKpiCount] = useState(0);

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
      if (!hasCap(me, 'crm_board', 'view')) {
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
    if (!Number.isFinite(planId) || planId <= 0) {
      setError('ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        const data = await fetchMarketingPlanDetail(access, planId);
        setPlan(data);
        setName(String(data.name ?? ''));
        setStatus(String(data.status ?? 'draft'));
        setNotes(String(data.notes ?? ''));
        try {
          const meUser = getStoredUser();
          if (
            meUser &&
            (hasCap(meUser, 'crm_kpi_hub', 'view') || hasCap(meUser, 'crm_kpi_hub_targets', 'view'))
          ) {
            const sum = await fetchRoleKpiSummary(access, planId);
            setReviewKpiCount(Number(sum.review_count ?? 0));
          }
        } catch {
          setReviewKpiCount(0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, planId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchMarketingPlan(access, planId, {
        name: name.trim(),
        status,
        notes: notes.trim(),
      });
      setPlan({ ...plan, ...updated });
      setMessage('Đã lưu');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
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
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Kế hoạch marketing" hideToolbar loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  const milestones = (plan?.milestones as Array<{ id: number; title: string; status: string }>) ?? [];

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title={`Kế hoạch #${planId}`}
      hideToolbar
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Triển khai DV', href: '/crm/service-delivery' },
        { label: 'Kế hoạch marketing', href: '/crm/marketing-plan' },
        { label: `#${planId}` },
      ]}
    >
      <DetailPageLayout
        backHref="/crm/marketing-plan"
        backLabel="← Kế hoạch marketing"
        title={`#${planId} · ${String(plan?.name ?? name)}`}
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}
        {reviewKpiCount > 0 ? (
          <p
            data-testid="role-kpi-review-banner"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            }}
          >
            Role KPI chờ duyệt ({reviewKpiCount}).{' '}
            <a href={`/crm/kpi-hub/role-kpi?plan_id=${planId}&status=review`}>Mở Role KPI →</a>
          </p>
        ) : null}
        {plan && !loading ? (
          <form onSubmit={(e) => void onSave(e)} style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="muted">Tên</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!hasCap(user, 'crm_board', 'edit') || saving}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text)',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="muted">Trạng thái</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!hasCap(user, 'crm_board', 'edit') || saving}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text)',
                }}
              >
                {['draft', 'review', 'active', 'paused', 'completed', 'archived', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="muted">Ghi chú</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={!hasCap(user, 'crm_board', 'edit') || saving}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text)',
                  resize: 'vertical',
                }}
              />
            </label>
            <button type="submit" className="btn btn-sm" disabled={saving || !hasCap(user, 'crm_board', 'edit')}>
              Lưu
            </button>
            {milestones.length > 0 ? (
              <div>
                <h3 style={{ fontSize: '1rem' }}>Milestone ({milestones.length})</h3>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {milestones.map((m) => (
                    <li key={m.id}>
                      {m.title} — {m.status}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        ) : null}
        {plan && !loading && getAccessToken() ? (
          <GrowthSectionsPanel
            token={getAccessToken()!}
            planId={planId}
            canEdit={hasCap(user, 'crm_board', 'edit')}
          />
        ) : null}
        {plan && !loading ? (
          <InsertInsightPlanPanel
            planId={planId}
            researchJson={plan.khtn_market_research_json}
            user={user}
            onInserted={(snapshot) => {
              setPlan((prev) =>
                prev ? { ...prev, khtn_market_research_json: JSON.stringify(snapshot) } : prev,
              );
              setMessage('Đã chèn insight');
            }}
          />
        ) : null}
      </DetailPageLayout>
    </CrmDeliveryPageShell>
  );
}

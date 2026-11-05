'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KpiGroupAuditPanel } from '@/components/kpi-groups/KpiGroupAuditPanel';
import { KpiGroupForm } from '@/components/kpi-groups/KpiGroupForm';
import { KpiGroupFormSidebar } from '@/components/kpi-groups/KpiGroupFormSidebar';
import { KpiGroupStatusBadge } from '@/components/kpi-groups/KpiGroupStatusBadge';
import { SegmentedControl, StaffPageShell } from '@/components/layout';
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
  fetchStaffOrgDepartments,
  fetchStaffOrgPositions,
  fetchStaffOrgTeams,
  staffMe,
  staffRefresh,
  type StaffDepartmentRow,
  type StaffOrgPositionRow,
  type StaffTeamRow,
} from '@/lib/api';
import {
  DEFAULT_KPI_GROUP_FORM,
  validateKpiGroupForm,
  type KpiGroupFormFieldErrors,
  type KpiGroupFormValues,
} from '@/lib/kpi-group-form.util';
import {
  fetchKpiGroup,
  fetchKpiGroupAudit,
  patchKpiGroup,
  type KpiGroupAuditEntry,
  type KpiGroupDetail,
} from '@/lib/kpi-groups-api';
import { kpiGroupErrorMessage } from '@/lib/kpi-group-util';

type DetailTab = 'config' | 'audit';

function detailToForm(detail: KpiGroupDetail): KpiGroupFormValues {
  return {
    code: detail.code,
    name: detail.name,
    description: detail.description ?? '',
    scope_type: detail.scope_type,
    department_ids: detail.department_ids,
    position_ids: detail.position_ids,
    default_direction: detail.default_direction,
    suggested_unit_types: detail.suggested_unit_types,
    data_domains: detail.data_domains,
    color: detail.color,
    icon: detail.icon ?? 'trending-up',
    display_order: detail.display_order,
    status: detail.status,
  };
}

export default function KpiGroupDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [detail, setDetail] = useState<KpiGroupDetail | null>(null);
  const [values, setValues] = useState<KpiGroupFormValues>(DEFAULT_KPI_GROUP_FORM);
  const [errors, setErrors] = useState<KpiGroupFormFieldErrors>({});
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [audit, setAudit] = useState<KpiGroupAuditEntry[]>([]);
  const [tab, setTab] = useState<DetailTab>(searchParams.get('tab') === 'audit' ? 'audit' : 'config');
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditError, setAuditError] = useState('');

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_groups', 'manage'));
  const codeLocked = Boolean(detail && (detail.usage_count > 0 || detail.is_system_default));

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
      if (!hasCap(me, 'crm_kpi_groups', 'view')) {
        setError('Không có quyền xem Nhóm KPI');
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

  const loadDetail = useCallback(
    async (access: string) => {
      const [group, depts, pos, teamRows] = await Promise.all([
        fetchKpiGroup(access, params.id),
        fetchStaffOrgDepartments(access),
        fetchStaffOrgPositions(access),
        fetchStaffOrgTeams(access),
      ]);
      setDetail(group);
      setValues(detailToForm(group));
      setDepartments(depts);
      setPositions(pos);
      setTeams(teamRows);
    },
    [params.id],
  );

  const loadAudit = useCallback(
    async (access: string) => {
      setAuditLoading(true);
      setAuditError('');
      try {
        const res = await fetchKpiGroupAudit(access, params.id);
        setAudit(res.data);
      } catch (err) {
        setAuditError(err instanceof Error ? err.message : 'Tải lịch sử thất bại');
      } finally {
        setAuditLoading(false);
      }
    },
    [params.id],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        await loadDetail(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải chi tiết Nhóm KPI thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadDetail]);

  useEffect(() => {
    if (tab !== 'audit') return;
    void (async () => {
      const access = getAccessToken();
      if (!access) return;
      await loadAudit(access);
    })();
  }, [tab, loadAudit]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function save(status?: 'DRAFT' | 'ACTIVE') {
    if (!detail) return;
    const nextValues = status ? { ...values, status } : values;
    const fieldErrors = validateKpiGroupForm(nextValues);
    const mapped: KpiGroupFormFieldErrors = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      mapped[k as keyof KpiGroupFormValues] = kpiGroupErrorMessage(String(v));
    }
    setErrors(mapped);
    if (Object.keys(fieldErrors).length) return;

    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const updated = await patchKpiGroup(
        access,
        detail.id,
        {
          code: codeLocked ? undefined : nextValues.code.trim(),
          name: nextValues.name.trim(),
          description: nextValues.description.trim() || undefined,
          scope_type: nextValues.scope_type,
          department_ids: nextValues.department_ids,
          position_ids: nextValues.position_ids,
          default_direction: nextValues.default_direction as 'INCREASE' | 'DECREASE' | 'RANGE',
          suggested_unit_types: nextValues.suggested_unit_types,
          data_domains: nextValues.data_domains,
          color: nextValues.color,
          icon: nextValues.icon || undefined,
          display_order: Number(nextValues.display_order) || undefined,
          status: nextValues.status,
        },
        detail.row_version,
      );
      setDetail(updated);
      setValues(detailToForm(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thay đổi thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      width="wide"
      breadcrumb={[
        { label: 'KPI & Hiệu suất', href: '/crm/kpi' },
        { label: 'Cấu hình' },
        { label: 'Nhóm KPI', href: '/crm/kpi/groups' },
        { label: detail?.name ?? 'Chi tiết' },
      ]}
    >
      <div className="kpi-group-form-page">
        <header className="kpi-group-form-page__head">
          <div>
            <h1>{detail?.name ?? 'Nhóm KPI'}</h1>
            <p className="muted">
              {detail ? (
                <>
                  <code>{detail.code}</code> · <KpiGroupStatusBadge status={detail.status} />
                </>
              ) : (
                'Chi tiết cấu hình Nhóm KPI'
              )}
            </p>
          </div>
        </header>

        <SegmentedControl
          value={tab}
          options={[
            { id: 'config' as const, label: 'Cấu hình' },
            { id: 'audit' as const, label: 'Lịch sử' },
          ]}
          onChange={setTab}
        />

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {tab === 'config' && !loading && detail ? (
          <div className="kpi-group-form-layout">
            <KpiGroupForm
              values={values}
              errors={errors}
              departments={departments}
              positions={positions}
              teams={teams}
              codeLocked={codeLocked}
              disabled={saving || !canManage}
              onChange={setValues}
            />
            <KpiGroupFormSidebar values={values} usageCount={detail.usage_count} isEdit />
          </div>
        ) : null}

        {tab === 'audit' ? (
          <KpiGroupAuditPanel entries={audit} loading={auditLoading} error={auditError} />
        ) : null}

        {tab === 'config' && canManage && detail ? (
          <footer className="kpi-group-form-footer">
            <Link href="/crm/kpi/groups" className="btn btn-sm btn-secondary">
              Hủy
            </Link>
            <div className="kpi-group-form-footer__primary">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={saving}
                onClick={() => void save('DRAFT')}
              >
                {saving ? 'Đang lưu…' : 'Lưu nháp'}
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
              {values.status !== 'ACTIVE' ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={saving}
                  onClick={() => void save('ACTIVE')}
                >
                  Lưu & Kích hoạt
                </button>
              ) : null}
            </div>
          </footer>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

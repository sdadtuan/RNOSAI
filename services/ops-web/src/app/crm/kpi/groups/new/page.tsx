'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiGroupForm } from '@/components/kpi-groups/KpiGroupForm';
import { KpiGroupFormSidebar } from '@/components/kpi-groups/KpiGroupFormSidebar';
import { StaffPageShell } from '@/components/layout';
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
import { createKpiGroup } from '@/lib/kpi-groups-api';
import { kpiGroupErrorMessage } from '@/lib/kpi-group-util';

export default function KpiGroupNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [values, setValues] = useState<KpiGroupFormValues>(DEFAULT_KPI_GROUP_FORM);
  const [errors, setErrors] = useState<KpiGroupFormFieldErrors>({});
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_groups', 'manage'));

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
      if (!hasCap(me, 'crm_kpi_groups', 'manage')) {
        setError('Không có quyền tạo Nhóm KPI');
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
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const [depts, pos, teamRows] = await Promise.all([
          fetchStaffOrgDepartments(access),
          fetchStaffOrgPositions(access),
          fetchStaffOrgTeams(access),
        ]);
        setDepartments(depts);
        setPositions(pos);
        setTeams(teamRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dữ liệu tham chiếu thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function save(status: 'DRAFT' | 'ACTIVE') {
    const nextValues = { ...values, status };
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
      const created = await createKpiGroup(access, {
        code: nextValues.code.trim(),
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
        status,
      });
      router.push(`/crm/kpi/groups/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu Nhóm KPI thất bại');
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
        { label: 'Thêm Nhóm KPI' },
      ]}
    >
      <div className="kpi-group-form-page">
        <header className="kpi-group-form-page__head">
          <div>
            <h1>Thêm Nhóm KPI</h1>
            <p className="muted">Thiết lập danh mục phân loại chỉ tiêu và phạm vi áp dụng.</p>
          </div>
        </header>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!canManage && !loading ? <p className="error">Không có quyền tạo Nhóm KPI.</p> : null}

        {!loading && canManage ? (
          <div className="kpi-group-form-layout">
            <KpiGroupForm
              values={values}
              errors={errors}
              departments={departments}
              positions={positions}
              teams={teams}
              disabled={saving}
              onChange={setValues}
            />
            <KpiGroupFormSidebar values={values} />
          </div>
        ) : null}

        <footer className="kpi-group-form-footer">
          <Link href="/crm/kpi/groups" className="btn btn-sm btn-secondary">
            Hủy
          </Link>
          <div className="kpi-group-form-footer__primary">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={saving || !canManage}
              onClick={() => void save('DRAFT')}
            >
              {saving ? 'Đang lưu…' : 'Lưu nháp'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={saving || !canManage}
              onClick={() => void save('ACTIVE')}
            >
              {saving ? 'Đang lưu…' : 'Lưu & Kích hoạt'}
            </button>
          </div>
        </footer>
      </div>
    </StaffPageShell>
  );
}

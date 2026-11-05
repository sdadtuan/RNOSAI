'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiTypeConfirmDialogs, type KpiTypeConfirmState } from '@/components/kpi-types/KpiTypeConfirmDialogs';
import { KpiTypeForm } from '@/components/kpi-types/KpiTypeForm';
import { KpiTypeFormSidebar } from '@/components/kpi-types/KpiTypeFormSidebar';
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
  DEFAULT_KPI_TYPE_FORM,
  validateKpiTypeForm,
  type KpiTypeFormFieldErrors,
  type KpiTypeFormValues,
} from '@/lib/kpi-type-form.util';
import { kpiTypeFormToBody } from '@/lib/kpi-type-form-body';
import { kpiTypeErrorMessage } from '@/lib/kpi-type-util';
import { fetchKpiGroups, type KpiGroupListItem } from '@/lib/kpi-groups-api';
import {
  createKpiType,
  fetchKpiTypeDataSources,
  fetchKpiTypeUnits,
  type KpiTypeSource,
  type KpiTypeUnit,
} from '@/lib/kpi-types-api';

export default function KpiTypeNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [values, setValues] = useState<KpiTypeFormValues>(DEFAULT_KPI_TYPE_FORM);
  const [errors, setErrors] = useState<KpiTypeFormFieldErrors>({});
  const [groups, setGroups] = useState<KpiGroupListItem[]>([]);
  const [units, setUnits] = useState<KpiTypeUnit[]>([]);
  const [sources, setSources] = useState<KpiTypeSource[]>([]);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ direction: false, unit: false });
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<KpiTypeConfirmState>(null);

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_types', 'manage'));

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
      if (!hasCap(me, 'crm_kpi_types', 'manage')) {
        setError('Không có quyền tạo KPI Type');
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
        const [groupRes, unitRows, sourceRows, depts, pos, teamRows] = await Promise.all([
          fetchKpiGroups(access, { status: 'ACTIVE', page_size: 100 }),
          fetchKpiTypeUnits(access),
          fetchKpiTypeDataSources(access),
          fetchStaffOrgDepartments(access),
          fetchStaffOrgPositions(access),
          fetchStaffOrgTeams(access),
        ]);
        setGroups(groupRes.data);
        setUnits(unitRows);
        setSources(sourceRows);
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

  function applyGroupSuggestions(groupId: string, force: boolean) {
    const group = groups.find((g) => g.id === groupId);
    setValues((prev) => {
      const next = { ...prev, kpi_group_id: groupId };
      if (!group) return next;
      if (force || !touched.direction) next.direction = group.default_direction;
      if (force || !touched.unit) {
        const suggested = (group as { suggested_unit_types?: string[] }).suggested_unit_types ?? [];
        const match = units.find((u) =>
          suggested.some((t) => t === u.code || (t === 'CURRENCY' && u.code === 'VND')),
        );
        if (match) next.unit_id = match.id;
      }
      return next;
    });
  }

  function onGroupChangeRequest(groupId: string) {
    if (!values.kpi_group_id || (!touched.direction && !touched.unit)) {
      applyGroupSuggestions(groupId, false);
      return;
    }
    setPendingGroupId(groupId);
    setConfirm({ kind: 'apply-group' });
  }

  async function save(status: 'DRAFT' | 'ACTIVE') {
    const nextValues = { ...values, status };
    const fieldErrors = validateKpiTypeForm(nextValues);
    const mapped: KpiTypeFormFieldErrors = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      mapped[k as keyof KpiTypeFormValues] = kpiTypeErrorMessage(String(v));
    }
    setErrors(mapped);
    if (Object.keys(fieldErrors).length) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const created = await createKpiType(access, { ...kpiTypeFormToBody(nextValues), status });
      router.push(`/crm/kpi/types/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu KPI Type thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      loading={!user}
      width="wide"
      breadcrumb={[
        { label: 'KPI & Hiệu suất', href: '/crm/kpi' },
        { label: 'Cấu hình' },
        { label: 'KPI Type', href: '/crm/kpi/types' },
        { label: 'Thêm KPI Type' },
      ]}
    >
      <div className="kpi-type-form-page">
        <header className="kpi-type-form-page__head">
          <div>
            <h1>Thêm KPI Type</h1>
            <p className="muted">Chuẩn hóa loại chỉ tiêu, đơn vị, mục tiêu và công thức nguồn dữ liệu.</p>
          </div>
        </header>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!canManage && !loading ? <p className="error">Không có quyền tạo KPI Type.</p> : null}
        {!loading && canManage ? (
          <div className="kpi-type-form-layout">
            <KpiTypeForm
              values={values}
              errors={errors}
              groups={groups}
              units={units}
              sources={sources}
              departments={departments}
              positions={positions}
              teams={teams}
              disabled={saving}
              onChange={(next) => {
                if (next.direction !== values.direction) setTouched((t) => ({ ...t, direction: true }));
                if (next.unit_id !== values.unit_id) setTouched((t) => ({ ...t, unit: true }));
                setValues(next);
              }}
              onGroupChangeRequest={onGroupChangeRequest}
            />
            <KpiTypeFormSidebar values={values} groups={groups} units={units} />
          </div>
        ) : null}
        <footer className="kpi-type-form-footer">
          <Link href="/crm/kpi/types" className="btn btn-sm btn-secondary">
            Hủy
          </Link>
          <div className="kpi-type-form-footer__primary">
            <button type="button" className="btn btn-sm btn-secondary" disabled={saving || !canManage} onClick={() => void save('DRAFT')}>
              {saving ? 'Đang lưu…' : 'Lưu nháp'}
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving || !canManage} onClick={() => void save('ACTIVE')}>
              {saving ? 'Đang lưu…' : 'Lưu & Kích hoạt'}
            </button>
          </div>
        </footer>
      </div>
      <KpiTypeConfirmDialogs
        state={confirm}
        onClose={() => {
          setConfirm(null);
          setPendingGroupId(null);
        }}
        onConfirm={(s) => {
          if (s.kind === 'apply-group' && pendingGroupId) applyGroupSuggestions(pendingGroupId, true);
          setConfirm(null);
          setPendingGroupId(null);
        }}
      />
    </StaffPageShell>
  );
}

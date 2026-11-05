'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiTypeForm } from '@/components/kpi-types/KpiTypeForm';
import { KpiTypeFormSidebar } from '@/components/kpi-types/KpiTypeFormSidebar';
import { KpiTypeStatusBadge } from '@/components/kpi-types/KpiTypeStatusBadge';
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
import { KPI_TYPE_VALIDATION_LABELS, kpiTypeErrorMessage, type KpiTypeValidationStatus } from '@/lib/kpi-type-util';
import { fetchKpiGroups, type KpiGroupListItem } from '@/lib/kpi-groups-api';
import {
  changeKpiTypeStatus,
  fetchKpiType,
  fetchKpiTypeAudit,
  fetchKpiTypeDataSources,
  fetchKpiTypeUnits,
  fetchKpiTypeVersions,
  patchKpiType,
  validateKpiTypeFormula,
  type KpiTypeDetail,
  type KpiTypeSource,
  type KpiTypeUnit,
} from '@/lib/kpi-types-api';

function detailToForm(detail: KpiTypeDetail): KpiTypeFormValues {
  return {
    ...DEFAULT_KPI_TYPE_FORM,
    kpi_group_id: detail.kpi_group_id,
    code: detail.code,
    name: detail.name,
    short_name: detail.short_name ?? '',
    description: detail.description ?? '',
    direction: detail.direction,
    value_type: detail.value_type,
    unit_id: detail.unit_id,
    decimal_places: detail.decimal_places,
    target_mode: detail.target_mode,
    minimum_target: detail.minimum_target != null ? String(detail.minimum_target) : '',
    default_target: String(detail.default_target ?? ''),
    stretch_target: detail.stretch_target != null ? String(detail.stretch_target) : '',
    lower_limit: detail.lower_limit != null ? String(detail.lower_limit) : '',
    upper_limit: detail.upper_limit != null ? String(detail.upper_limit) : '',
    calculation_mode: detail.calculation_mode,
    primary_data_source_id: detail.primary_data_source_id ?? '',
    data_entity: detail.data_entity ?? '',
    aggregation_type: detail.aggregation_type ?? 'COUNT',
    formula_expression: detail.formula_expression ?? '',
    formula_display: detail.formula_display ?? '',
    sync_frequency: detail.sync_frequency ?? 'DAILY',
    divide_by_zero_fallback: detail.divide_by_zero_fallback,
    manual_evidence_required: detail.manual_evidence_required,
    scope_type: detail.scope_type as KpiTypeFormValues['scope_type'],
    department_ids: detail.department_ids.map(String),
    position_ids: detail.position_ids,
    weight_min: detail.weight_min != null ? String(detail.weight_min) : '',
    weight_max: detail.weight_max != null ? String(detail.weight_max) : '',
    display_order: detail.display_order,
    status: detail.status,
  };
}

export default function KpiTypeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [detail, setDetail] = useState<KpiTypeDetail | null>(null);
  const [values, setValues] = useState<KpiTypeFormValues>(DEFAULT_KPI_TYPE_FORM);
  const [errors, setErrors] = useState<KpiTypeFormFieldErrors>({});
  const [groups, setGroups] = useState<KpiGroupListItem[]>([]);
  const [units, setUnits] = useState<KpiTypeUnit[]>([]);
  const [sources, setSources] = useState<KpiTypeSource[]>([]);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [versions, setVersions] = useState<unknown[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [validationStatus, setValidationStatus] = useState<KpiTypeValidationStatus>('NOT_TESTED');
  const [preview, setPreview] = useState<{ formatted_value: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = Boolean(user && hasCap(user, 'crm_kpi_types', 'manage'));
  const canConfigure = Boolean(
    user && (hasCap(user, 'crm_kpi_types', 'configure') || hasCap(user, 'crm_kpi_types', 'manage')),
  );

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
      if (!hasCap(me, 'crm_kpi_types', 'view')) {
        setError('Không có quyền xem KPI Type');
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
      const [row, groupRes, unitRows, sourceRows, depts, pos, teamRows, vers, logs] = await Promise.all([
        fetchKpiType(access, params.id),
        fetchKpiGroups(access, { page_size: 100 }),
        fetchKpiTypeUnits(access),
        fetchKpiTypeDataSources(access),
        fetchStaffOrgDepartments(access),
        fetchStaffOrgPositions(access),
        fetchStaffOrgTeams(access),
        fetchKpiTypeVersions(access, params.id).catch(() => []),
        fetchKpiTypeAudit(access, params.id).catch(() => ({ data: [] })),
      ]);
      setDetail(row);
      setValues(detailToForm(row));
      setValidationStatus(row.validation_status);
      setGroups(groupRes.data);
      setUnits(unitRows);
      setSources(sourceRows);
      setDepartments(depts);
      setPositions(pos);
      setTeams(teamRows);
      setVersions(vers);
      setAudit(logs.data ?? []);
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
      try {
        await load(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải KPI Type thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, load]);

  async function save(status?: 'DRAFT' | 'ACTIVE') {
    const nextValues = { ...values, status: status ?? values.status };
    const fieldErrors = validateKpiTypeForm(nextValues);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    const access = getAccessToken();
    if (!access || !detail) return;
    setSaving(true);
    setError('');
    try {
      const updated = await patchKpiType(access, detail.id, kpiTypeFormToBody(nextValues), detail.row_version);
      if (status && status !== detail.status) {
        const after = await changeKpiTypeStatus(access, detail.id, status);
        setDetail(after);
        setValues(detailToForm(after));
      } else {
        setDetail(updated);
        setValues(detailToForm(updated));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onValidate() {
    const access = getAccessToken();
    if (!access || !detail) return;
    setSaving(true);
    setError('');
    try {
      const out = await validateKpiTypeFormula(access, detail.id, {
        formula_expression: values.formula_expression,
        data_source_id: values.primary_data_source_id || undefined,
      });
      setValidationStatus(out.validation_status);
      setPreview(out.preview);
      if (out.validation_status !== 'VALID') setError(out.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : kpiTypeErrorMessage('KPI_TYPE_FORMULA_INVALID'));
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
        { label: detail?.code ?? 'Chi tiết' },
      ]}
    >
      <div className="kpi-type-form-page">
        <header className="kpi-type-form-page__head">
          <div>
            <h1>{detail?.name ?? 'KPI Type'}</h1>
            <p className="muted">
              <code>{detail?.code}</code> · phiên bản {detail?.current_version ?? 1}
            </p>
          </div>
          {detail ? <KpiTypeStatusBadge status={detail.status} /> : null}
        </header>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && detail ? (
          <div className="kpi-type-form-layout">
            <KpiTypeForm
              values={values}
              errors={errors}
              groups={groups.filter((g) => g.status === 'ACTIVE' || g.id === values.kpi_group_id)}
              units={units}
              sources={sources}
              departments={departments}
              positions={positions}
              teams={teams}
              disabled={saving || !canManage}
              onChange={setValues}
              onGroupChangeRequest={(id) => setValues((v) => ({ ...v, kpi_group_id: id }))}
            />
            <KpiTypeFormSidebar
              values={values}
              groups={groups}
              units={units}
              validationStatus={validationStatus}
              usageCount={detail.usage_count}
              preview={preview}
            />
          </div>
        ) : null}

        {detail ? (
          <section className="kpi-type-form-section">
            <h2 className="kpi-type-form-section__title">Phiên bản &amp; audit</h2>
            <p className="muted">
              Công thức: {KPI_TYPE_VALIDATION_LABELS[validationStatus]}
              {preview?.formatted_value ? ` · Preview ${preview.formatted_value}` : ''}
            </p>
            <p className="muted">{versions.length} phiên bản · {audit.length} bản ghi audit</p>
          </section>
        ) : null}

        <footer className="kpi-type-form-footer">
          <Link href="/crm/kpi/types" className="btn btn-sm btn-secondary">
            Hủy
          </Link>
          <div className="kpi-type-form-footer__primary">
            {canConfigure && values.calculation_mode !== 'MANUAL' ? (
              <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => void onValidate()}>
                Kiểm tra công thức
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-secondary" disabled={saving || !canManage} onClick={() => void save('DRAFT')}>
              Lưu nháp
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving || !canManage} onClick={() => void save('ACTIVE')}>
              Lưu &amp; Kích hoạt
            </button>
          </div>
        </footer>
      </div>
    </StaffPageShell>
  );
}

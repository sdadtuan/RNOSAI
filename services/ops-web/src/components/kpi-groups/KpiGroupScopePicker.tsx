'use client';

import type { StaffDepartmentRow, StaffOrgPositionRow, StaffTeamRow } from '@/lib/api';
import type { KpiGroupScopeType } from '@/lib/kpi-group-util';
import { labelKpiGroupScope } from '@/lib/kpi-group-util';

type KpiGroupScopePickerProps = {
  scopeType: KpiGroupScopeType;
  departmentIds: string[];
  positionIds: number[];
  departments: StaffDepartmentRow[];
  positions: StaffOrgPositionRow[];
  teams: StaffTeamRow[];
  disabled?: boolean;
  onScopeTypeChange: (scope: KpiGroupScopeType) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onPositionIdsChange: (ids: number[]) => void;
  scopeError?: string;
};

const SEGMENTS: Array<{ id: KpiGroupScopeType; label: string }> = [
  { id: 'ORGANIZATION', label: 'Toàn DN' },
  { id: 'DEPARTMENT', label: 'Theo phòng ban' },
  { id: 'POSITION', label: 'Theo chức danh' },
];

function teamDepartmentMap(teams: StaffTeamRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const t of teams) {
    if (t.department_id != null) map.set(t.id, t.department_id);
  }
  return map;
}

export function KpiGroupScopePicker({
  scopeType,
  departmentIds,
  positionIds,
  departments,
  positions,
  teams,
  disabled,
  onScopeTypeChange,
  onDepartmentIdsChange,
  onPositionIdsChange,
  scopeError,
}: KpiGroupScopePickerProps) {
  const teamDept = teamDepartmentMap(teams);
  const selectedDeptNums = departmentIds.map(Number).filter((n) => Number.isFinite(n));

  const filteredPositions =
    scopeType === 'POSITION' && selectedDeptNums.length
      ? positions.filter((p) => {
          if (p.team_id == null) return false;
          const deptId = teamDept.get(p.team_id);
          return deptId != null && selectedDeptNums.includes(deptId);
        })
      : positions;

  function toggleDepartment(id: string) {
    const next = departmentIds.includes(id) ? departmentIds.filter((d) => d !== id) : [...departmentIds, id];
    onDepartmentIdsChange(next);
    if (scopeType === 'POSITION') {
      const allowed = new Set(
        positions
          .filter((p) => {
            if (p.team_id == null) return false;
            const deptId = teamDept.get(p.team_id);
            return deptId != null && next.map(Number).includes(deptId);
          })
          .map((p) => p.id),
      );
      onPositionIdsChange(positionIds.filter((pid) => allowed.has(pid)));
    }
  }

  function togglePosition(id: number) {
    onPositionIdsChange(positionIds.includes(id) ? positionIds.filter((p) => p !== id) : [...positionIds, id]);
  }

  return (
    <div className="kpi-group-scope-picker">
      <div className="kpi-group-segmented" role="group" aria-label="Phạm vi áp dụng">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.id}
            type="button"
            className={`kpi-group-segmented__btn${scopeType === seg.id ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => onScopeTypeChange(seg.id)}
          >
            {seg.label}
          </button>
        ))}
      </div>
      <p className="muted kpi-group-scope-picker__hint">{labelKpiGroupScope(scopeType)}</p>

      {scopeType !== 'ORGANIZATION' ? (
        <div className="kpi-group-scope-picker__block">
          <p className="kpi-group-form__label">Phòng ban áp dụng</p>
          <div className="kpi-group-multi-select">
            {departments.filter((d) => d.active).map((d) => {
              const id = String(d.id);
              const checked = departmentIds.includes(id);
              return (
                <label key={d.id} className={`kpi-group-chip-select${checked ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleDepartment(id)}
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {scopeType === 'POSITION' ? (
        <div className="kpi-group-scope-picker__block">
          <p className="kpi-group-form__label">Chức danh áp dụng</p>
          {selectedDeptNums.length === 0 ? (
            <p className="muted">Chọn ít nhất một phòng ban để lọc chức danh.</p>
          ) : (
            <div className="kpi-group-multi-select">
              {filteredPositions.filter((p) => p.active).map((p) => {
                const checked = positionIds.includes(p.id);
                return (
                  <label key={p.id} className={`kpi-group-chip-select${checked ? ' is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePosition(p.id)}
                    />
                    {p.name}
                    {p.team_name ? <span className="muted"> · {p.team_name}</span> : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {scopeError ? <p className="error">{scopeError}</p> : null}
    </div>
  );
}

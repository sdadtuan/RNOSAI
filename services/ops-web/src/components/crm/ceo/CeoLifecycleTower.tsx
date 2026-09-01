'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CeoActionConfirmDialog } from '@/components/crm/ceo/CeoActionConfirmDialog';
import { CeoTowerDeptHeatmap } from '@/components/crm/ceo/CeoTowerDeptHeatmap';
import { CeoTowerFunnelChart } from '@/components/crm/ceo/CeoTowerFunnelChart';
import { CeoTowerMetricStrip } from '@/components/crm/ceo/CeoTowerMetricStrip';
import { SegmentedControl } from '@/components/layout';
import { fetchCeoContext, type CeoTurnOutput } from '@/lib/api';
import { confirmCopy } from '@/lib/crm/ceo-command-confirm.util';
import { commitProposedCeoAction, proposeCeoAction } from '@/lib/crm/ceo-command-propose';
import { fetchCeoTower, type TowerColumnId, type TowerException, type TowerPayload } from '@/lib/crm/ceo-tower-api';
import {
  mapTowerSuggestAction,
  parseOwnerStaffIdInput,
} from '@/lib/crm/ceo-tower-suggest.util';
import {
  TOWER_EMPTY_STATE_COPY,
  TOWER_OUTSIDE_CYCLE_COPY,
  buildTowerBreadcrumb,
  departmentRollupEntries,
  exceptionQueueSummary,
  isOutsideCycleDepartment,
  parseTowerFactory,
  towerHealthTone,
  type TowerFactoryFilter,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoLifecycleTowerProps = {
  token: string;
};

function headerBadgeClass(severity: string): string {
  if (severity === 'red') return 'badge badge-error';
  if (severity === 'amber') return 'badge badge-warning';
  return 'badge badge-success';
}

function healthSummaryClass(tone: 'ok' | 'warn' | 'critical'): string {
  if (tone === 'critical') return 'ceo-tower-health ceo-tower-health--critical';
  if (tone === 'warn') return 'ceo-tower-health ceo-tower-health--warn';
  return 'ceo-tower-health ceo-tower-health--ok';
}

export function CeoLifecycleTower({ token }: CeoLifecycleTowerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const factory = parseTowerFactory(searchParams.get('factory'));
  const columnId = (searchParams.get('column_id') ?? '') as TowerColumnId | '';
  const department = searchParams.get('department') ?? '';
  const team = searchParams.get('team') ?? '';
  const positionCode = searchParams.get('position_code') ?? '';
  const staffId = searchParams.get('staff_id') ?? '';
  const legalEntityId = searchParams.get('legal_entity_id') ?? '';

  const [payload, setPayload] = useState<TowerPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [canAct, setCanAct] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTurn, setConfirmTurn] = useState<CeoTurnOutput | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const query = useMemo(() => {
    const q: Record<string, string> = {
      factory,
      severity: searchParams.get('severity') || 'red,amber',
    };
    if (columnId) q.column_id = columnId;
    if (department) q.department = department;
    if (team) q.team = team;
    if (positionCode) q.position_code = positionCode;
    if (staffId) q.staff_id = staffId;
    if (legalEntityId) q.legal_entity_id = legalEntityId;
    return q;
  }, [factory, columnId, department, team, positionCode, staffId, legalEntityId, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayload(await fetchCeoTower(token, query));
    } catch {
      setError('Không tải được tháp chu trình');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetchCeoContext(token)
      .then((out) => {
        if (!cancelled) setCanAct(Boolean(out.can_act));
      })
      .catch(() => {
        if (!cancelled) setCanAct(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSuggest(row: TowerException) {
    const mapped = mapTowerSuggestAction(row, { can_act: canAct !== false });
    if (mapped.kind === 'hidden' || mapped.kind === 'upcoming') return;
    let params = { ...mapped.params };
    if (mapped.kind === 'needs_owner') {
      const owner = parseOwnerStaffIdInput(window.prompt('Nhập owner_staff_id'));
      if (owner == null) return;
      params.owner_staff_id = owner;
    }
    setBusy(true);
    setError('');
    try {
      const out = await proposeCeoAction(token, { action_id: mapped.action_id, params });
      if (!out.proposed_action) {
        setError(out.reply_vi || 'Không đề xuất được hành động');
        return;
      }
      setConfirmTurn(out);
      setIdempotencyKey(crypto.randomUUID());
    } catch (e) {
      setError(String((e as Error).message ?? 'Gợi ý thất bại'));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!confirmTurn?.turn_id || !idempotencyKey) return;
    setBusy(true);
    setError('');
    try {
      await commitProposedCeoAction(token, {
        turn_id: confirmTurn.turn_id,
        idempotency_key: idempotencyKey,
      });
      setConfirmTurn(null);
    } catch (e) {
      setError(String((e as Error).message ?? 'Commit thất bại'));
    } finally {
      setBusy(false);
    }
  }

  function patchQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/crm/ceo?${qs}` : '/crm/ceo', { scroll: false });
  }

  function onFactory(next: TowerFactoryFilter) {
    patchQuery({ factory: next });
  }

  function onColumn(id: TowerColumnId) {
    const next = columnId === id ? '' : id;
    patchQuery({
      column_id: next || null,
      severity: 'red,amber',
    });
  }

  function onDepartment(code: string, outsideCycle?: boolean) {
    if (outsideCycle) {
      patchQuery({ department: code, team: null, position_code: null, staff_id: null });
      return;
    }
    patchQuery({
      department: department === code ? null : code,
      team: null,
      position_code: null,
      staff_id: null,
    });
  }

  function clearOrgFilters() {
    patchQuery({
      department: null,
      team: null,
      position_code: null,
      staff_id: null,
    });
  }

  function onCapacityStaff(id: number) {
    patchQuery({
      staff_id: staffId === String(id) ? null : String(id),
      team: null,
      position_code: null,
    });
  }

  function onLegalEntity(id: string) {
    patchQuery({
      legal_entity_id: legalEntityId === id ? null : id,
    });
  }

  const breadcrumb = buildTowerBreadcrumb({
    factory,
    department: department || null,
    team: team || null,
    position_code: positionCode || null,
    staff_id: staffId || null,
    orgRollup: payload?.org_rollup,
  });
  const deptRows = departmentRollupEntries(payload?.org_rollup);
  const outsideCycleActive = isOutsideCycleDepartment(department, payload?.org_rollup);

  const exceptions = payload?.exceptions ?? [];
  const summary = payload
    ? payload.columns.reduce(
        (acc, col) => {
          acc.total += col.red_count + col.amber_count;
          acc.red += col.red_count;
          acc.amber += col.amber_count;
          return acc;
        },
        { total: 0, red: 0, amber: 0 },
      )
    : { ...exceptionQueueSummary(exceptions), amber: 0 };
  const healthTone = towerHealthTone(summary.total, summary.red);

  return (
    <section className="page-card stack-gap ceo-tower-panel" data-testid="ceo-lifecycle-tower" aria-label="Tháp chu trình">
      <header className="ceo-tower-header">
        <div>
          <h2 className="text-lg font-semibold">Tháp chu trình</h2>
          <p className="muted text-sm">Cửa sổ sót 7 ngày · nhìn nút thắt trước khi drill</p>
        </div>
        <div className={healthSummaryClass(healthTone)} data-testid="ceo-tower-health">
          <div className="ceo-tower-health__stat">
            <span className="ceo-tower-health__value">{summary.red}</span>
            <span className="ceo-tower-health__label">Đỏ</span>
          </div>
          <div className="ceo-tower-health__stat">
            <span className="ceo-tower-health__value">{summary.amber}</span>
            <span className="ceo-tower-health__label">Vàng</span>
          </div>
          <div className="ceo-tower-health__stat">
            <span className="ceo-tower-health__value">{summary.total}</span>
            <span className="ceo-tower-health__label">Tổng sót</span>
          </div>
        </div>
        <div className="ceo-tower-header__actions">
          <SegmentedControl
            label="Nhà máy"
            options={[
              { id: 'A', label: 'A' },
              { id: 'B', label: 'B' },
              { id: 'both', label: 'Cả hai' },
            ]}
            value={factory}
            onChange={onFactory}
          />
          <Link href="/crm/ceo/board-pack" className="btn btn-sm btn-secondary">
            In tuần
          </Link>
        </div>
      </header>

      <nav
        className="flex flex-wrap items-center gap-1 text-sm"
        data-testid="ceo-tower-breadcrumb"
        aria-label="Lăng kính tổ chức"
      >
        {breadcrumb.map((segment, index) => (
          <span key={segment.key} className="flex items-center gap-1">
            {index > 0 ? <span className="muted">›</span> : null}
            {segment.clearTo ? (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => patchQuery(segment.clearTo!)}
              >
                {segment.label}
              </button>
            ) : (
              <span>{segment.label}</span>
            )}
          </span>
        ))}
        {department || team || positionCode || staffId ? (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            aria-label="Xóa lọc tổ chức"
            data-testid="ceo-tower-breadcrumb-clear"
            onClick={clearOrgFilters}
          >
            ×
          </button>
        ) : null}
      </nav>

      {deptRows.length ? (
        <CeoTowerDeptHeatmap
          orgRollup={payload?.org_rollup}
          activeDepartment={department}
          onDepartment={onDepartment}
        />
      ) : null}

      {payload?.legal_entity_filter_enabled && payload.legal_entity_options?.length ? (
        <div data-testid="ceo-tower-entity-panel" className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium">Pháp nhân:</span>
          {payload.legal_entity_options.map((row) => (
            <button
              key={row.id}
              type="button"
              data-testid={`ceo-tower-entity-${row.id}`}
              className={`btn btn-xs ${legalEntityId === row.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onLegalEntity(row.id)}
            >
              {row.label_vi}
            </button>
          ))}
        </div>
      ) : null}

      {payload?.degraded?.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Nguồn degraded">
          {payload.degraded.map((item) => (
            <span
              key={`${item.source}-${item.reason}`}
              className="badge"
              style={{ background: '#e5e7eb', color: '#4b5563' }}
            >
              {item.source}
            </span>
          ))}
        </div>
      ) : null}

      <CeoTowerMetricStrip kStrip={payload?.k_strip} financeStrip={payload?.finance_strip} />

      {payload?.capacity_top?.length ? (
        <div data-testid="ceo-tower-capacity" aria-label="Quá tải">
          <h3 className="text-base font-semibold">Quá tải</h3>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Phòng</th>
                  <th>Đỏ</th>
                  <th>Vàng</th>
                </tr>
              </thead>
              <tbody>
                {payload.capacity_top.slice(0, 5).map((row) => (
                  <tr key={row.staff_id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        data-testid={`ceo-tower-capacity-${row.staff_id}`}
                        onClick={() => onCapacityStaff(row.staff_id)}
                      >
                        {row.name}
                        <span className={`ml-2 ${headerBadgeClass(row.flag)}`}>{row.flag}</span>
                      </button>
                    </td>
                    <td>{row.department_code || '—'}</td>
                    <td>{row.red_owned}</td>
                    <td>{row.amber_owned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loading && !payload ? <p className="muted">Đang tải tháp…</p> : null}

      {!loading || payload ? (
        <CeoTowerFunnelChart
          columns={payload?.columns}
          factory={factory}
          activeColumnId={columnId}
          onColumn={onColumn}
        />
      ) : null}

      <div
        data-testid="ceo-tower-queue"
        data-can-act={canAct == null ? 'pending' : canAct ? 'yes' : 'no'}
      >
        <h3 className="text-base font-semibold">Hàng chờ sót</h3>
        {outsideCycleActive ? (
          <p className="muted" data-testid="ceo-tower-outside-cycle-empty">
            {TOWER_OUTSIDE_CYCLE_COPY}
          </p>
        ) : exceptions.length === 0 ? (
          <p className="muted">{TOWER_EMPTY_STATE_COPY}</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table ceo-tower-queue">
              <thead>
                <tr>
                  <th>Nhà máy</th>
                  <th>Việc</th>
                  <th>Tuổi</th>
                  <th>Owner</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((row) => (
                  <tr
                    key={`${row.entity_type}-${row.entity_id}-${row.column_id}-${row.title_vi}`}
                    className={`ceo-tower-queue__row ceo-tower-queue__row--${row.severity}`}
                  >
                    <td>
                      <span className="badge">{row.factory}</span>
                    </td>
                    <td>{row.title_vi}</td>
                    <td>{row.age_label}</td>
                    <td>{row.owner_name || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link href={row.href} className="btn btn-sm btn-secondary">
                          Mở
                        </Link>
                        <SuggestChip
                          row={row}
                          canAct={canAct}
                          busy={busy}
                          onSuggest={() => void onSuggest(row)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmTurn?.proposed_action ? (
        <CeoActionConfirmDialog
          copy={confirmCopy(confirmTurn.proposed_action)}
          busy={busy}
          onCancel={() => setConfirmTurn(null)}
          onConfirm={() => void onConfirm()}
        />
      ) : null}
    </section>
  );
}

function SuggestChip({
  row,
  canAct,
  busy,
  onSuggest,
}: {
  row: TowerException;
  canAct: boolean | null;
  busy: boolean;
  onSuggest: () => void;
}) {
  if (canAct == null) return null;
  const mapped = mapTowerSuggestAction(row, { can_act: canAct });
  if (mapped.kind === 'hidden') return null;
  if (mapped.kind === 'upcoming') {
    return (
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        disabled
        title={mapped.tooltip}
      >
        Gợi ý
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      disabled={busy}
      onClick={onSuggest}
    >
      Gợi ý
    </button>
  );
}

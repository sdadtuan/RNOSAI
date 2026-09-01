'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CeoActionConfirmDialog } from '@/components/crm/ceo/CeoActionConfirmDialog';
import { CeoTowerDeptDonut } from '@/components/crm/ceo/CeoTowerDeptDonut';
import { CeoTowerDeptPicker } from '@/components/crm/ceo/CeoTowerDeptPicker';
import { CeoTowerExceptionQueue } from '@/components/crm/ceo/CeoTowerExceptionQueue';
import { CeoTowerFunnelChart } from '@/components/crm/ceo/CeoTowerFunnelChart';
import { CeoTowerMetricStrip } from '@/components/crm/ceo/CeoTowerMetricStrip';
import { CeoTowerOrgLens } from '@/components/crm/ceo/CeoTowerOrgLens';
import { CeoTowerTrendPanel } from '@/components/crm/ceo/CeoTowerTrendPanel';
import { SegmentedControl } from '@/components/layout';
import { fetchCeoContext, type CeoTurnOutput } from '@/lib/api';
import { confirmCopy } from '@/lib/crm/ceo-command-confirm.util';
import { commitProposedCeoAction, proposeCeoAction } from '@/lib/crm/ceo-command-propose';
import { fetchCeoTower, type TowerColumnId, type TowerException, type TowerPayload } from '@/lib/crm/ceo-tower-api';
import {
  filterTowerExceptions,
  type TowerDrillFilters,
} from '@/lib/crm/ceo-tower-filter.util';
import {
  mapTowerSuggestAction,
  parseOwnerStaffIdInput,
} from '@/lib/crm/ceo-tower-suggest.util';
import {
  TOWER_EMPTY_STATE_COPY,
  TOWER_OUTSIDE_CYCLE_COPY,
  buildTowerBreadcrumb,
  departmentRollupEntries,
  isOutsideCycleDepartment,
  parseTowerFactory,
  parseTowerSeverityFilter,
  towerHealthTone,
  formatTowerWowDelta,
  type TowerFactoryFilter,
  type TowerOrgRollupEntry,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoLifecycleTowerProps = {
  token: string;
};

type DrillState = {
  department: string;
  team: string;
  positionCode: string;
  staffId: string;
};

function drillFromParams(sp: URLSearchParams): DrillState {
  return {
    department: sp.get('department') ?? '',
    team: sp.get('team') ?? '',
    positionCode: sp.get('position_code') ?? '',
    staffId: sp.get('staff_id') ?? '',
  };
}

function healthSummaryClass(tone: 'ok' | 'warn' | 'critical'): string {
  if (tone === 'critical') return 'ceo-tower-health ceo-tower-health--critical';
  if (tone === 'warn') return 'ceo-tower-health ceo-tower-health--warn';
  return 'ceo-tower-health ceo-tower-health--ok';
}

function capacityFlagClass(flag: string): string {
  if (flag === 'red') return 'ceo-tower-capacity-flag ceo-tower-capacity-flag--red';
  return 'ceo-tower-capacity-flag ceo-tower-capacity-flag--amber';
}

function deptLabel(code: string, orgRollup: TowerOrgRollupEntry[] | undefined): string {
  return departmentRollupEntries(orgRollup).find((row) => row.code === code)?.label_vi ?? code;
}

export function CeoLifecycleTower({ token }: CeoLifecycleTowerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queueRef = useRef<HTMLDivElement>(null);

  const factory = parseTowerFactory(searchParams.get('factory'));
  const severityFilter = parseTowerSeverityFilter(searchParams.get('severity'));
  const columnId = (searchParams.get('column_id') ?? '') as TowerColumnId | '';
  const legalEntityId = searchParams.get('legal_entity_id') ?? '';

  const [drill, setDrill] = useState<DrillState>(() => drillFromParams(searchParams));
  const [payload, setPayload] = useState<TowerPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [canAct, setCanAct] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTurn, setConfirmTurn] = useState<CeoTurnOutput | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    setDrill(drillFromParams(searchParams));
  }, [searchParams]);

  const apiQuery = useMemo(() => {
    const q: Record<string, string> = {
      factory,
      severity: severityFilter,
      limit: '80',
    };
    if (columnId) q.column_id = columnId;
    if (legalEntityId) q.legal_entity_id = legalEntityId;
    return q;
  }, [factory, severityFilter, columnId, legalEntityId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayload(await fetchCeoTower(token, apiQuery));
    } catch {
      setError('Không tải được tháp chu trình');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, apiQuery]);

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

  const drillFilters: TowerDrillFilters = useMemo(
    () => ({
      department: drill.department || undefined,
      team: drill.team || undefined,
      position_code: drill.positionCode || undefined,
      staff_id: drill.staffId || undefined,
    }),
    [drill],
  );

  const allExceptions = payload?.exceptions ?? [];
  const deptScopedExceptions = useMemo(
    () => filterTowerExceptions(allExceptions, { department: drill.department || undefined }),
    [allExceptions, drill.department],
  );
  const exceptions = useMemo(
    () => filterTowerExceptions(allExceptions, drillFilters),
    [allExceptions, drillFilters],
  );

  function patchQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/crm/ceo?${qs}` : '/crm/ceo', { scroll: false });
  }

  function patchDrill(next: Partial<DrillState>) {
    const merged = { ...drill, ...next };
    setDrill(merged);
    patchQuery({
      department: merged.department || null,
      team: merged.team || null,
      position_code: merged.positionCode || null,
      staff_id: merged.staffId || null,
    });
  }

  function scrollToQueue() {
    requestAnimationFrame(() => {
      queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function onFactory(next: TowerFactoryFilter) {
    patchQuery({ factory: next });
  }

  function onSeverityFilter(next: 'red,amber' | 'red' | 'amber') {
    patchQuery({ severity: next });
  }

  function onColumn(id: TowerColumnId) {
    const next = columnId === id ? '' : id;
    patchQuery({ column_id: next || null });
  }

  function onDepartment(code: string, outsideCycle?: boolean) {
    const selecting = drill.department !== code;
    patchDrill({
      department: code,
      team: '',
      positionCode: '',
      staffId: '',
    });
    if (selecting || outsideCycle) scrollToQueue();
  }

  function onOrgLensSelect(level: TowerOrgRollupEntry['level'], code: string) {
    if (level === 'team') {
      patchDrill({
        team: drill.team === code ? '' : code,
        positionCode: '',
        staffId: '',
      });
      scrollToQueue();
      return;
    }
    if (level === 'position') {
      patchDrill({
        positionCode: drill.positionCode === code ? '' : code,
        staffId: '',
      });
      scrollToQueue();
      return;
    }
    if (level === 'staff') {
      patchDrill({ staffId: drill.staffId === code ? '' : code });
      scrollToQueue();
    }
  }

  function clearOrgFilters() {
    patchDrill({ department: '', team: '', positionCode: '', staffId: '' });
  }

  function onOwnerFilter(id: number) {
    patchDrill({
      staffId: drill.staffId === String(id) ? '' : String(id),
      team: '',
      positionCode: '',
    });
    scrollToQueue();
  }

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
      await load();
    } catch (e) {
      setError(String((e as Error).message ?? 'Commit thất bại'));
    } finally {
      setBusy(false);
    }
  }

  const breadcrumb = buildTowerBreadcrumb({
    factory,
    department: drill.department || null,
    team: drill.team || null,
    position_code: drill.positionCode || null,
    staff_id: drill.staffId || null,
    orgRollup: payload?.org_rollup,
  });
  const outsideCycleActive = isOutsideCycleDepartment(drill.department, payload?.org_rollup);

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
    : { total: 0, red: 0, amber: 0 };
  const healthTone = towerHealthTone(summary.total, summary.red);
  const filteredRed = exceptions.filter((row) => row.severity === 'red').length;
  const filteredAmber = exceptions.filter((row) => row.severity === 'amber').length;

  return (
    <section className="page-card stack-gap ceo-tower-panel" data-testid="ceo-lifecycle-tower" aria-label="Tháp chu trình">
      <header className="ceo-tower-header">
        <div className="ceo-tower-header__intro">
          <h2 className="ceo-tower-header__title">Tháp chu trình</h2>
          <p className="ceo-tower-header__subtitle">Nhìn toàn công ty → chọn phòng → drill tiếp → xử lý hàng chờ</p>
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
          {payload?.trends ? (
            <div
              className={`ceo-tower-health__wow ceo-tower-health__wow--${payload.trends.wow.direction}`}
              data-testid="ceo-tower-health-wow"
            >
              <span className="ceo-tower-health__value">{formatTowerWowDelta(payload.trends.wow)}</span>
              <span className="ceo-tower-health__label">7 ngày</span>
            </div>
          ) : null}
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
          <SegmentedControl
            label="Mức độ"
            options={[
              { id: 'red,amber', label: 'Đỏ + Vàng' },
              { id: 'red', label: 'Chỉ đỏ' },
              { id: 'amber', label: 'Chỉ vàng' },
            ]}
            value={severityFilter}
            onChange={onSeverityFilter}
          />
          <Link href="/crm/ceo/board-pack" className="btn btn-sm btn-secondary">
            In tuần
          </Link>
        </div>
      </header>

      <CeoTowerDeptPicker
        orgRollup={payload?.org_rollup}
        activeDepartment={drill.department}
        onDepartment={onDepartment}
      />

      {drill.department ? (
        <div className="ceo-tower-drill-banner" data-testid="ceo-tower-drill-banner">
          <div>
            <strong>Đang drill: {deptLabel(drill.department, payload?.org_rollup)}</strong>
            <span className="ceo-tower-drill-banner__meta">
              {filteredRed} đỏ · {filteredAmber} vàng · {exceptions.length} việc trong hàng chờ
            </span>
          </div>
          <button type="button" className="btn btn-xs btn-secondary" onClick={clearOrgFilters}>
            Xóa lọc phòng
          </button>
        </div>
      ) : null}

      <nav className="ceo-tower-breadcrumb" data-testid="ceo-tower-breadcrumb" aria-label="Lăng kính tổ chức">
        {breadcrumb.map((segment, index) => (
          <span key={segment.key} className="ceo-tower-breadcrumb__segment">
            {index > 0 ? <span className="ceo-tower-breadcrumb__sep">›</span> : null}
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
        {drill.department || drill.team || drill.positionCode || drill.staffId ? (
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

      {drill.department ? (
        <CeoTowerOrgLens
          orgRollup={payload?.org_rollup}
          scopeExceptions={deptScopedExceptions}
          drill={drillFilters}
          onSelect={onOrgLensSelect}
        />
      ) : null}

      <div className="ceo-tower-dashboard">
        <div className="ceo-tower-dashboard__main">
          {!loading || payload ? (
            <CeoTowerFunnelChart
              columns={payload?.columns}
              factory={factory}
              activeColumnId={columnId}
              trendByColumn={payload?.trends?.series.by_column}
              onColumn={onColumn}
            />
          ) : null}
          <CeoTowerMetricStrip kStrip={payload?.k_strip} financeStrip={payload?.finance_strip} />
          <CeoTowerTrendPanel trends={payload?.trends} />
        </div>

        <aside className="ceo-tower-dashboard__side">
          <CeoTowerDeptDonut
            orgRollup={payload?.org_rollup}
            activeDepartment={drill.department}
            onDepartment={onDepartment}
          />
        </aside>
      </div>

      {payload?.legal_entity_filter_enabled && payload.legal_entity_options?.length ? (
        <div data-testid="ceo-tower-entity-panel" className="ceo-tower-entity-panel">
          <span className="ceo-tower-entity-panel__label">Pháp nhân:</span>
          {payload.legal_entity_options.map((row) => (
            <button
              key={row.id}
              type="button"
              data-testid={`ceo-tower-entity-${row.id}`}
              className={`btn btn-xs ${legalEntityId === row.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => patchQuery({ legal_entity_id: legalEntityId === row.id ? null : row.id })}
            >
              {row.label_vi}
            </button>
          ))}
        </div>
      ) : null}

      {payload?.degraded?.length ? (
        <div className="ceo-tower-degraded" aria-label="Nguồn degraded">
          {payload.degraded.map((item) => (
            <span key={`${item.source}-${item.reason}`} className="ceo-tower-degraded__badge">
              {item.source}
            </span>
          ))}
        </div>
      ) : null}

      {payload?.capacity_top?.length ? (
        <div data-testid="ceo-tower-capacity" className="ceo-tower-capacity" aria-label="Quá tải">
          <h3 className="ceo-tower-section-title">Quá tải</h3>
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
                        onClick={() => onOwnerFilter(row.staff_id)}
                      >
                        {row.name}
                        <span className={capacityFlagClass(row.flag)}>{row.flag}</span>
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

      <div
        ref={queueRef}
        className="ceo-tower-queue-section"
        data-testid="ceo-tower-queue"
        data-can-act={canAct == null ? 'pending' : canAct ? 'yes' : 'no'}
      >
        <div className="ceo-tower-queue-section__head">
          <h3 className="ceo-tower-section-title">
            {drill.department ? `Hàng chờ — ${deptLabel(drill.department, payload?.org_rollup)}` : 'Hàng chờ sót'}
          </h3>
          <span className="ceo-tower-queue-section__count">{exceptions.length} việc</span>
        </div>
        <CeoTowerExceptionQueue
          exceptions={exceptions}
          canAct={canAct}
          busy={busy}
          outsideCycleActive={outsideCycleActive}
          emptyCopy={
            drill.department
              ? `Không có sót trong phòng này với bộ lọc hiện tại — thử bỏ lọc cột/mức độ.`
              : TOWER_EMPTY_STATE_COPY
          }
          outsideCycleCopy={TOWER_OUTSIDE_CYCLE_COPY}
          onOwnerFilter={onOwnerFilter}
          onSuggest={(row) => void onSuggest(row)}
        />
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

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CeoActionConfirmDialog } from '@/components/crm/ceo/CeoActionConfirmDialog';
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
  TOWER_COLUMN_DEFS,
  TOWER_EMPTY_STATE_COPY,
  exceptionQueueSummary,
  parseTowerFactory,
  towerColumnUnusedLabel,
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

function kStatusClass(status: string): string {
  if (status === 'red') return 'badge badge-error';
  if (status === 'amber') return 'badge badge-warning';
  if (status === 'green') return 'badge badge-success';
  return 'badge';
}

export function CeoLifecycleTower({ token }: CeoLifecycleTowerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const factory = parseTowerFactory(searchParams.get('factory'));
  const columnId = (searchParams.get('column_id') ?? '') as TowerColumnId | '';

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
    return q;
  }, [factory, columnId, searchParams]);

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

  const columnsById = useMemo(() => {
    const map = new Map((payload?.columns ?? []).map((col) => [col.column_id, col]));
    return map;
  }, [payload]);

  const exceptions = payload?.exceptions ?? [];
  const summary = payload
    ? payload.columns.reduce(
        (acc, col) => {
          acc.total += col.red_count + col.amber_count;
          acc.red += col.red_count;
          return acc;
        },
        { total: 0, red: 0 },
      )
    : exceptionQueueSummary(exceptions);

  return (
    <section className="page-card stack-gap" data-testid="ceo-lifecycle-tower" aria-label="Tháp chu trình">
      <header className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tháp chu trình</h2>
          <p className="muted text-sm">
            {summary.total} sót · {summary.red} đỏ
          </p>
        </div>
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
      </header>

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

      {payload?.k_strip?.length ? (
        <div className="flex flex-wrap gap-2" data-testid="ceo-tower-k-strip" aria-label="Chỉ số K">
          {payload.k_strip.map((item) => (
            <Link key={item.key} href={item.href} className={kStatusClass(item.status)}>
              {item.key.toUpperCase()}
              {item.value != null ? ` ${item.value}` : ''}
            </Link>
          ))}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loading && !payload ? <p className="muted">Đang tải tháp…</p> : null}

      <div className="data-table-wrap" data-testid="ceo-tower-columns">
        <div style={{ display: 'flex', gap: '0.65rem', minWidth: 720 }}>
          {TOWER_COLUMN_DEFS.map((def) => {
            const col = columnsById.get(def.id);
            const unused = towerColumnUnusedLabel(def.id, factory);
            const severity = col?.header_severity ?? 'ok';
            const degraded = col?.degraded;
            const active = columnId === def.id;
            return (
              <button
                key={def.id}
                type="button"
                data-testid={`ceo-tower-column-${def.id}`}
                aria-pressed={active}
                className="page-card stack-gap"
                style={{
                  flex: '1 0 140px',
                  minWidth: 140,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: active ? 'var(--primary)' : undefined,
                }}
                onClick={() => onColumn(def.id)}
              >
                <strong>{def.label}</strong>
                {degraded ? (
                  <span className="badge" style={{ background: '#e5e7eb', color: '#4b5563' }}>
                    degraded
                  </span>
                ) : unused ? (
                  <span className="muted">{unused}</span>
                ) : (
                  <span className={headerBadgeClass(severity)}>
                    {col ? `${col.red_count} đỏ · ${col.amber_count} vàng` : '—'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        data-testid="ceo-tower-queue"
        data-can-act={canAct == null ? 'pending' : canAct ? 'yes' : 'no'}
      >
        <h3 className="text-base font-semibold">Hàng chờ sót</h3>
        {exceptions.length === 0 ? (
          <p className="muted">{TOWER_EMPTY_STATE_COPY}</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
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
                  <tr key={`${row.entity_type}-${row.entity_id}-${row.column_id}-${row.title_vi}`}>
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

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import {
  fetchLeadOpsDesk,
  fetchLeadOpsLeads,
  fetchLeadOpsPool,
  leadOpsAssignFromQueue,
  leadOpsExtendHold,
  leadOpsMarkInvalid,
  leadOpsReassign,
  runLeadSlaReassignJob,
  staffMe,
  staffRefresh,
  type LeadOpsDeskSummary,
  type LeadOpsRow,
  type LeadOpsTab,
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

function fmtTs(raw: string | null): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('vi-VN');
  } catch {
    return raw;
  }
}

const TAB_ORDER: LeadOpsTab[] = ['p0', 'p1', 'p2', 'p3'];

export default function GdkdLeadOpsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [desk, setDesk] = useState<LeadOpsDeskSummary | null>(null);
  const [tab, setTab] = useState<LeadOpsTab>('p0');
  const [rows, setRows] = useState<LeadOpsRow[]>([]);
  const [pool, setPool] = useState<Array<{ staff_id: number; open_attempting: number }>>([]);
  const [pickStaff, setPickStaff] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<number | 'job' | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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

  const reload = useCallback(
    async (access: string, nextTab: LeadOpsTab = tab) => {
      setLoading(true);
      setError('');
      try {
        const [summary, list, poolRows] = await Promise.all([
          fetchLeadOpsDesk(access),
          fetchLeadOpsLeads(access, nextTab),
          fetchLeadOpsPool(access),
        ]);
        setDesk(summary);
        setRows(list.items);
        setPool(
          poolRows
            .filter((p) => p.accepts_leads && p.active)
            .map((p) => ({ staff_id: p.staff_id, open_attempting: p.open_attempting })),
        );
      } finally {
        setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    void (async () => {
      try {
        const access = await ensureAuth();
        if (!access) return;
        await reload(access, tab);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload, tab]);

  const canAct =
    hasCap(user, 'crm_gdkd', 'view_all_leads') ||
    hasCap(user, 'crm_gdkd', 'assign') ||
    String(user?.position_code ?? '').toUpperCase().includes('SUPER') ||
    String(user?.position_code ?? '').toUpperCase().includes('SALES');

  const onTab = (t: LeadOpsTab) => {
    setTab(t);
  };

  const withBusy = async (leadId: number | 'job', fn: (token: string) => Promise<void>) => {
    setBusy(leadId);
    setError('');
    setMsg('');
    try {
      const access = await ensureAuth();
      if (!access) return;
      await fn(access);
      await reload(access, tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const tiles: KpiTileProps[] = desk
    ? [
        {
          label: 'FR1 breached',
          value: String(desk.widgets.fr1_breached),
          tone: desk.widgets.fr1_breached > 0 ? 'critical' : 'success',
          hint: 'P0 — tách hold-expiry',
        },
        {
          label: 'Hold ≤4h LV',
          value: String(desk.widgets.hold_due_within_4wh),
          tone: desk.widgets.hold_due_within_4wh > 0 ? 'warning' : 'default',
          hint: 'P1 hold_until',
        },
        {
          label: 'Redistribute queue',
          value: String(desk.widgets.redistribute_queue),
          tone: desk.widgets.queue_alert_over_1wh > 0 ? 'critical' : 'default',
          hint:
            desk.widgets.queue_max_age_hours != null
              ? `max age ${desk.widgets.queue_max_age_hours}h · alert ${desk.widgets.queue_alert_over_1wh}`
              : 'empty',
        },
        {
          label: '1a no meeting >1 WD',
          value: String(desk.widgets.meet_pending_no_meeting_over_1wd),
          tone: desk.widgets.meet_pending_no_meeting_over_1wd > 0 ? 'warning' : 'default',
        },
        {
          label: 'No-touch >48h',
          value: String(desk.widgets.no_touch_over_48h),
          tone: desk.widgets.no_touch_over_48h > 0 ? 'warning' : 'default',
        },
        {
          label: 'Dry-run would-reassign',
          value: String(desk.widgets.dry_run_would_reassign),
          hint: desk.flags.lead_sla_reassign_dry_run ? 'dry_run ON' : 'dry_run OFF',
          tone: desk.flags.lead_sla_reassign_dry_run ? 'default' : 'default',
        },
      ]
    : [];

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar
        title="Lead Ops · GĐKD"
        subtitle="P10.c · FR1 / hold / queue desk — không cần SQL"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href="/crm/admin/lead-sla-settings">
              Settings
            </Link>
            {canAct ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy === 'job'}
                onClick={() =>
                  void withBusy('job', async (token) => {
                    const out = await runLeadSlaReassignJob(token, true);
                    setMsg(
                      `Job ${out.mode} · would=${out.would_reassign} reassigned=${out.reassigned} queue_alerts=${out.queue_alerts}`,
                    );
                  })
                }
              >
                Chạy job (force)
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <KpiTileGrid tiles={tiles} />

      {desk?.fr_on_time_by_am?.length ? (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>% FR on-time by AM</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>AM</th>
                <th>Today</th>
                <th>Week</th>
              </tr>
            </thead>
            <tbody>
              {desk.fr_on_time_by_am.slice(0, 12).map((a) => (
                <tr key={a.owner_id}>
                  <td>{a.owner_name}</td>
                  <td>
                    {a.today_pct != null ? `${a.today_pct}%` : '—'}{' '}
                    <span className="muted">
                      ({a.today_on_time}/{a.today_total})
                    </span>
                  </td>
                  <td>
                    {a.week_pct != null ? `${a.week_pct}%` : '—'}{' '}
                    <span className="muted">
                      ({a.week_on_time}/{a.week_total})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 8px', flexWrap: 'wrap' }}>
        {TAB_ORDER.map((t) => {
          const meta = desk?.tabs[t];
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              className={active ? 'btn btn-primary' : 'btn'}
              onClick={() => onTab(t)}
              title={meta?.hint}
            >
              {meta?.label ?? t.toUpperCase()}
              {meta ? ` (${meta.count})` : ''}
            </button>
          );
        })}
      </div>

      <p className="muted" style={{ marginBottom: 8 }}>
        {desk?.tabs[tab]?.hint ?? ''}
        {loading ? ' · loading…' : ` · ${rows.length} rows`}
        {desk?.flags.lead_sla_reassign_enabled
          ? ' · live reassign ON'
          : desk?.flags.lead_sla_reassign_dry_run
            ? ' · dry_run ON'
            : ''}
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Company</th>
            <th>AM</th>
            <th>Contact</th>
            <th>Last call</th>
            <th>Att</th>
            <th>FR1 due</th>
            <th>Hold</th>
            <th>Re#</th>
            <th>Hot</th>
            <th>Kind</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const selected = pickStaff[r.lead_id] ?? '';
            const acting = busy === r.lead_id;
            return (
              <tr key={`${r.list_kind}-${r.lead_id}`}>
                <td>
                  <Link href={`/crm/leads/${r.lead_id}`}>
                    {r.lead_id}
                    {r.full_name ? ` · ${r.full_name}` : ''}
                  </Link>
                </td>
                <td>{r.company_name || '—'}</td>
                <td>{r.owner_name ?? (r.owner_id != null ? `#${r.owner_id}` : '—')}</td>
                <td>
                  <code>{r.contact_status || '—'}</code>
                  {r.queue_age_hours != null ? (
                    <div className="muted" style={{ fontSize: 11 }}>
                      age {r.queue_age_hours}h
                    </div>
                  ) : null}
                </td>
                <td>
                  <code>{r.last_call_result || '—'}</code>
                </td>
                <td>{r.attempts_since_assign}</td>
                <td>{fmtTs(r.fr1_due_at)}</td>
                <td>{fmtTs(r.hold_until)}</td>
                <td>{r.reassign_count}</td>
                <td>{r.is_hot ? 'yes' : ''}</td>
                <td>
                  <code style={{ fontSize: 11 }}>{r.list_kind}</code>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                    <Link href={`/crm/leads/${r.lead_id}`} className="btn" style={{ fontSize: 12 }}>
                      Open
                    </Link>
                    {canAct ? (
                      <>
                        <select
                          value={selected}
                          onChange={(e) =>
                            setPickStaff((p) => ({ ...p, [r.lead_id]: e.target.value }))
                          }
                          style={{ fontSize: 12 }}
                        >
                          <option value="">Auto pool</option>
                          {pool.map((p) => (
                            <option key={p.staff_id} value={String(p.staff_id)}>
                              #{p.staff_id} (open {p.open_attempting})
                            </option>
                          ))}
                        </select>
                        {r.list_kind === 'queue' ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={acting || !selected}
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              void withBusy(r.lead_id, async (token) => {
                                await leadOpsAssignFromQueue(token, r.lead_id, Number(selected));
                                setMsg(`Assigned ${r.lead_id} → ${selected}`);
                              })
                            }
                          >
                            Assign queue
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={acting}
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              void withBusy(r.lead_id, async (token) => {
                                const out = await leadOpsReassign(token, r.lead_id, {
                                  to_staff_id: selected ? Number(selected) : undefined,
                                  reason: `gdkd_${r.list_kind}`,
                                });
                                setMsg(`Reassigned ${r.lead_id} → ${out.to_staff_id}`);
                              })
                            }
                          >
                            Reassign
                          </button>
                        )}
                        {r.list_kind === 'hold_expiry' || r.hold_profile === '1b' ? (
                          <button
                            type="button"
                            className="btn"
                            disabled={acting || r.sla_extend_count >= 1}
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              void withBusy(r.lead_id, async (token) => {
                                const out = await leadOpsExtendHold(token, r.lead_id);
                                setMsg(`Extended ${r.lead_id} → ${out.hold_until}`);
                              })
                            }
                          >
                            Extend hold
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn"
                          disabled={acting}
                          style={{ fontSize: 12 }}
                          onClick={() =>
                            void withBusy(r.lead_id, async (token) => {
                              await leadOpsMarkInvalid(token, r.lead_id, 'gdkd_desk');
                              setMsg(`Marked invalid ${r.lead_id}`);
                            })
                          }
                        >
                          Mark invalid
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {!rows.length && !loading ? (
            <tr>
              <td colSpan={12} className="muted">
                Không có lead trong tab này.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </StaffPageShell>
  );
}

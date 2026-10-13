'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { ApiError, staffMe, staffRefresh } from '@/lib/api';
import { downloadAeRanking, fetchAeAlerts, fetchAeInterventions, fetchAeRanking, fetchAeTeamSummary, postAeAlertAck, postAeAlertResolve, postAeIntake, type AeRankBoard, type AeTeamAlertItem, type AeTeamSummary } from '@/lib/crm/ae-team-api';
import { deskPulseKey, deskPulseUnchanged } from '@/lib/crm/ae-team-pulse.util';
import { AeTeamInterventions } from './AeTeamInterventions';
import { sortAeTeamRows, type AeTeamSortKey, type AeTeamSortRow } from '@/lib/crm/ae-team-table.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import './ae-team.css';

function dash(value: number | null | undefined, suffix = ''): string {
  if (value == null) return '—';
  return `${value}${suffix}`;
}

function money(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(value);
}

const COLUMNS: Array<{ key: AeTeamSortKey; label: string }> = [
  { key: 'name', label: 'AE' },
  { key: 'open_leads', label: 'Đang giữ' },
  { key: 'sla_breach', label: 'Trễ SLA' },
  { key: 'sla_warning', label: 'Sắp trễ' },
  { key: 'within_sla_pct', label: '% đúng SLA' },
  { key: 'avg_first_response_minutes', label: 'Phản hồi (phút)' },
  { key: 'calls', label: 'Cuộc gọi' },
  { key: 'answer_pct', label: '% nghe máy' },
  { key: 'stale', label: 'Đứng yên' },
  { key: 'missed_callbacks', label: 'Hẹn lỡ' },
  { key: 'lead_to_quote_pct', label: 'Lead → báo giá' },
  { key: 'quote_to_won_pct', label: 'Báo giá → chốt' },
  { key: 'revenue_vnd', label: 'Doanh số' },
  { key: 'attainment_pct', label: '% chỉ tiêu' },
];

export default function AeTeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<AeTeamSummary | null>(null);
  const [alerts, setAlerts] = useState<AeTeamAlertItem[]>([]);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<AeTeamSortKey>('sla_breach');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [tab, setTab] = useState<'desk' | 'rank'>('desk');
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>('day');
  const [ranking, setRanking] = useState<AeRankBoard | null>(null);
  const [stage, setStage] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pulseKey = useRef('');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const load = useCallback(async (access: string, silent = false) => {
    const [summary, interventions] = await Promise.all([
      fetchAeTeamSummary(access, {
        preset,
        from: preset === 'custom' ? from : undefined,
        to: preset === 'custom' ? to : undefined,
      }),
      fetchAeInterventions(access),
    ]);
    const nextPulse = deskPulseKey({
      breaches: summary.members.map((member) => ({ staffId: member.staff_id, slaBreach: member.sla_breach })),
      interventionIds: interventions.items.map((item) => item.lead_id),
    });
    if (silent && deskPulseUnchanged(pulseKey.current, nextPulse)) return;
    pulseKey.current = nextPulse;
    setData(summary);
    setRefreshKey((value) => value + 1);
    const open = await fetchAeAlerts(access);
    setAlerts(open.items);
  }, [from, preset, to]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    staffMe(access)
      .then((me) => {
        setUser(me);
        updateStoredUser(me);
        return load(access);
      })
      .catch(async (err: unknown) => {
        const refresh = getRefreshToken();
        if (!(err instanceof ApiError) || err.status !== 401 || !refresh) {
          setError(err instanceof ApiError ? err.message : 'Không tải được đội AE');
          return;
        }
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          setToken(out.access_token);
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
          await load(out.access_token);
        } catch {
          clearSession();
          router.replace('/login');
        }
      });
  }, [load, router]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      void load(token, true).catch(() => {
        /* Giữ số đang hiện khi lần làm mới lỗi. */
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load, token]);

  useEffect(() => {
    if (!token || tab !== 'rank') return;
    fetchAeRanking(token, grain)
      .then(setRanking)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không tải được xếp hạng'));
  }, [grain, tab, token]);

  const rows = useMemo(() => sortAeTeamRows(data?.members ?? [], sortKey, sortDir), [data, sortDir, sortKey]);

  function toggleSort(key: AeTeamSortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout} width="full" breadcrumb={[{ label: 'Đội AE' }]}>
      <div className={stage ? 'ae-team-stage' : undefined}>
      <PageToolbar title="Đội AE" subtitle="Lead đang giữ là sổ hiện tại. Tỷ lệ và cuộc gọi theo kỳ đã chọn." />
      <div className="ae-team-filters">
        <button type="button" className={tab === 'desk' ? 'btn btn-sm btn-primary' : 'btn btn-sm'} onClick={() => setTab('desk')}>Đội</button>
        <button type="button" className={tab === 'rank' ? 'btn btn-sm btn-primary' : 'btn btn-sm'} onClick={() => setTab('rank')}>Xếp hạng</button>
        <button type="button" className="btn btn-sm" onClick={() => setStage((value) => !value)}>{stage ? 'Thoát trình chiếu' : 'Trình chiếu'}</button>
        {(['today', 'week', 'month', 'custom'] as const).map((item) => (
          <button key={item} type="button" className={preset === item ? 'btn btn-sm btn-primary' : 'btn btn-sm'} onClick={() => setPreset(item)}>
            {item === 'today' ? 'Hôm nay' : item === 'week' ? 'Tuần' : item === 'month' ? 'Tháng' : 'Tùy chọn'}
          </button>
        ))}
        {preset === 'custom' ? (
          <>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </>
        ) : null}
        <button type="button" className="btn btn-sm" disabled={!token} onClick={() => token && load(token).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không tải được đội AE'))}>
          Xem
        </button>
      </div>
      {error ? <p>{error}</p> : null}
      {token && tab === 'desk' ? (
        <AeTeamInterventions
          token={token}
          preset={preset}
          members={data?.members ?? []}
          refreshKey={refreshKey}
          onChanged={() => { void load(token).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không tải được đội AE')); }}
        />
      ) : null}
      {data ? (
        <div className="ae-team-cards">
          <div className="ae-team-card"><span>Lead đội</span><strong>{data.totals.open_leads}</strong></div>
          <div className="ae-team-card"><span>% đúng SLA</span><strong>{dash(data.totals.within_sla_pct, '%')}</strong></div>
          <div className="ae-team-card"><span>Cần chú ý</span><strong>{data.totals.attention}</strong></div>
          <div className="ae-team-card"><span>Doanh số / chỉ tiêu</span><strong>{money(data.totals.revenue_vnd)} / {money(data.totals.quota_vnd)}</strong></div>
        </div>
      ) : null}
      {tab === 'rank' && ranking ? (
        <>
          <div className="ae-team-filters">
            {(['day', 'week', 'month'] as const).map((item) => (
              <button key={item} type="button" className={grain === item ? 'btn btn-sm btn-primary' : 'btn btn-sm'} onClick={() => setGrain(item)}>
                {item === 'day' ? 'Ngày' : item === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
            <button type="button" className="btn btn-sm" disabled={!token} onClick={() => token && downloadAeRanking(token, grain).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không xuất được CSV'))}>CSV</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Hạng</th><th>AE</th><th>Điểm</th><th>% đúng SLA</th><th>% nghe máy</th><th>% chốt</th><th>% chỉ tiêu</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.length === 0 ? <tr><td colSpan={7}>Chưa có AE trong team.</td></tr> : ranking.rows.map((row) => (
                  <tr key={row.staff_id}>
                    <td>{row.rank}</td>
                    <td><Link href={`/crm/b2b/team/${row.staff_id}`}>{row.name}</Link></td>
                    <td>{dash(row.score)}</td>
                    <td>{dash(row.sla_pct, '%')}</td>
                    <td>{dash(row.call_pct, '%')}</td>
                    <td>{dash(row.conversion_pct, '%')}</td>
                    <td>{dash(row.revenue_pct, '%')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {tab === 'desk' && data ? (
        <>
          <div className="table-wrap">
            <table className="table ae-team-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key}>
                      <button type="button" className="btn btn-sm" onClick={() => toggleSort(column.key)}>
                        {column.label}{sortKey === column.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  ))}
                  <th>Nhận lead</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={16}>Chưa có AE trong team.</td></tr>
                ) : rows.map((row) => (
                  <TeamRow
                    key={row.staff_id}
                    row={row}
                    alerts={alerts.filter((alert) => alert.ownerStaffId === row.staff_id)}
                    onToggle={() => {
                      void postAeIntake(token, { staff_id: row.staff_id, accepting: !row.accepting })
                        .then(() => load(token))
                        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không đổi được nhận lead'));
                    }}
                    onAck={(id) => {
                      void postAeAlertAck(token, id).then(() => load(token)).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không xác nhận được'));
                    }}
                    onResolve={(id) => {
                      void postAeAlertResolve(token, id).then(() => load(token)).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không đóng được cảnh báo'));
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      </div>
    </StaffPageShell>
  );
}

const ALERT_LABEL: Record<string, string> = {
  'AE-SLA': 'Trễ SLA',
  'HOT-AE': 'Nóng chưa gọi',
  'HOT-AM': 'Nóng quá nhịp',
  'AE-IDLE': 'Chưa gọi',
  'AE-DROP': 'Tụt tỷ lệ',
  ESC: 'Leo thang',
};

function TeamRow({
  row,
  alerts,
  onToggle,
  onAck,
  onResolve,
}: {
  row: AeTeamSortRow;
  alerts: AeTeamAlertItem[];
  onToggle: () => void;
  onAck: (id: number) => void;
  onResolve: (id: number) => void;
}) {
  const held = `${row.by_status.moi} / ${row.by_status.da_lien_he} / ${row.by_status.dang_tu_van} / ${row.by_status.bao_gia}`;
  return (
    <tr className={`ae-tone-${row.tone}`}>
      <td><Link href={`/crm/b2b/team/${row.staff_id}`}>{row.name}</Link></td>
      <td title="Mới / Đã liên hệ / Đang tư vấn / Báo giá">{held}</td>
      <td>{row.sla_breach}</td>
      <td>{row.sla_warning}</td>
      <td>{dash(row.within_sla_pct, '%')}</td>
      <td>{dash(row.avg_first_response_minutes)}</td>
      <td>{row.calls}</td>
      <td>{dash(row.answer_pct, '%')}</td>
      <td>{row.stale}</td>
      <td>{row.missed_callbacks}</td>
      <td>{dash(row.lead_to_quote_pct, '%')}</td>
      <td>{dash(row.quote_to_won_pct, '%')}</td>
      <td>{money(row.revenue_vnd)}</td>
      <td>{dash(row.attainment_pct, '%')}</td>
      <td>
        <button type="button" className="btn btn-sm" onClick={onToggle}>{row.accepting ? 'Bật' : 'Tắt'}</button>
      </td>
      <td>
        {alerts.length === 0 ? '—' : alerts.map((alert) => (
          <span key={alert.id}>
            {ALERT_LABEL[alert.ruleCode] ?? alert.ruleCode} {alert.level}
            {alert.status === 'open' ? <button type="button" className="btn btn-sm" onClick={() => onAck(alert.id)}>Đã xem</button> : null}
            <button type="button" className="btn btn-sm" onClick={() => onResolve(alert.id)}>Đã xử lý</button>
          </span>
        ))}
      </td>
    </tr>
  );
}

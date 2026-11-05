'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { LeadKanbanBoard } from '@/components/crm/LeadKanbanBoard';
import { ApiError, staffMe, staffRefresh, type LeadRow } from '@/lib/api';
import { fetchAeTeamLeads, fetchAeTeamMember, postAeInstructionRead, type AeTeamSeriesPoint, type AeTeamTimeline } from '@/lib/crm/ae-team-api';
import type { AeTeamSortRow } from '@/lib/crm/ae-team-table.util';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken, updateStoredUser, type StoredStaffUser } from '@/lib/auth';
import '../ae-team.css';

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default function AeTeamMemberPage() {
  const params = useParams<{ aeId: string }>();
  const staffId = Number(params.aeId);
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [member, setMember] = useState<AeTeamSortRow | null>(null);
  const [timeline, setTimeline] = useState<AeTeamTimeline | null>(null);
  const [series, setSeries] = useState<AeTeamSeriesPoint[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState('');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access || !Number.isFinite(staffId)) {
      router.replace('/login');
      return;
    }
    setToken(access);
    staffMe(access)
      .then(async (me) => {
        setUser(me);
        updateStoredUser(me);
        const detail = await fetchAeTeamMember(access, staffId, { preset: 'month' });
        setMember(detail.member);
        setTimeline(detail.timeline);
        setSeries(detail.series);
        setLeads(await fetchAeTeamLeads(access, staffId));
      })
      .catch(async (err: unknown) => {
        const refresh = getRefreshToken();
        if (!(err instanceof ApiError) || err.status !== 401 || !refresh) {
          setError(err instanceof ApiError ? err.message : 'Không tải được AE');
          return;
        }
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          setToken(out.access_token);
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
          const detail = await fetchAeTeamMember(out.access_token, staffId, { preset: 'month' });
          setMember(detail.member);
          setTimeline(detail.timeline);
          setSeries(detail.series);
          setLeads(await fetchAeTeamLeads(out.access_token, staffId));
        } catch {
          clearSession();
          router.replace('/login');
        }
      });
  }, [router, staffId]);

  const maxCalls = Math.max(1, ...series.map((point) => point.calls));
  const events = [
    ...(timeline?.activities ?? []).map((row) => ({ at: row.created_at, text: `${row.activity_type}: ${row.content}`, id: `a-${row.id}` })),
    ...(timeline?.assignments ?? []).map((row) => ({ at: row.created_at, text: `Đổi phụ trách ${row.from_owner_id ?? '—'} → ${row.to_owner_id ?? '—'}. ${row.reason}`, id: `g-${row.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="full"
      breadcrumb={[{ label: 'Đội AE', href: '/crm/b2b/team' }, { label: member?.name ?? 'AE' }]}
    >
      <PageToolbar
        title={member?.name ?? 'AE'}
        subtitle="Kanban chỉ để xem. Gọi và chuyển lead nằm ở giai đoạn sau."
        actions={<Link className="btn btn-sm" href="/crm/b2b/team">Về đội</Link>}
      />
      {error ? <p>{error}</p> : null}
      <h2>30 ngày</h2>
      <div className="ae-team-bars" aria-label="Số cuộc gọi 30 ngày">
        {series.map((point) => (
          <span key={point.day} title={`${point.day}: ${point.calls} cuộc gọi, SLA ${point.within_sla_pct ?? '—'}%`} style={{ height: `${Math.max(4, (point.calls / maxCalls) * 72)}px` }} />
        ))}
      </div>
      <h2>Kanban</h2>
      <LeadKanbanBoard rows={leads} flowKind="b2b_prospect" token={token} readOnly />
      <h2>Hoạt động</h2>
      <ul>
        {events.length === 0 ? <li>Chưa có hoạt động.</li> : events.slice(0, 30).map((event) => (
          <li key={event.id}>{when(event.at)} — {event.text}</li>
        ))}
      </ul>
      <h2>Ghi chú chỉ đạo</h2>
      <ul>
        {(timeline?.instructions ?? []).length === 0 ? <li>Chưa có ghi chú.</li> : timeline?.instructions.map((note) => (
          <li key={note.id}>
            {when(note.created_at)} — {note.content} — {note.read_at ? 'Đã đọc' : 'Chưa đọc'}
            {note.read_at ? null : (
              <button type="button" className="btn btn-sm" onClick={() => {
                postAeInstructionRead(token, note.id)
                  .then(() => setTimeline((current) => current ? {
                    ...current,
                    instructions: current.instructions.map((item) => item.id === note.id ? { ...item, read_at: new Date().toISOString() } : item),
                  } : current))
                  .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Không xác nhận được'));
              }}>Đánh dấu đã đọc</button>
            )}
          </li>
        ))}
      </ul>
    </StaffPageShell>
  );
}

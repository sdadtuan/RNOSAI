'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import { CrmLeadsImportExport } from '@/components/crm/CrmLeadsImportExport';
import { CrmLeadsList } from '@/components/crm/CrmLeadsList';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { fetchLeads, bulkAssignLeads, fetchCrmStaffList, staffMe, staffRefresh } from '@/lib/api';
import type { CrmStaffRow, LeadRow } from '@/lib/api';
import { aiCopilotEnabled, isAiPilotUser } from '@/lib/ai-flags';
import { useLeadScoresMap } from '@/hooks/useLeadScoresMap';
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

const PAGE_SIZE = 50;

export default function CrmLeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [listTab, setListTab] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canImport = useMemo(
    () => hasCap(user, 'crm_leads', 'edit') || hasCap(user, 'crm_leads', 'assign'),
    [user],
  );
  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);

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
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem CRM leads');
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

  const loadLeads = useCallback(
    async (accessToken: string, nextOffset: number, search: string) => {
      setLoading(true);
      setError('');
      try {
        const ownerId =
          listTab === 'mine' && user?.id ? Number(user.id) : undefined;
        const data = await fetchLeads(accessToken, {
          q: search || undefined,
          status: filterStatus || undefined,
          source: filterSource || undefined,
          channel: filterChannel || undefined,
          owner_id: ownerId,
          unassigned_only: listTab === 'unassigned',
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setRows(data.leads);
        setTotal(data.total);
        setOffset(data.offset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải leads thất bại');
      } finally {
        setLoading(false);
      }
    },
    [filterChannel, filterSource, filterStatus, listTab, user?.id],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      const staffOut = await fetchCrmStaffList(access).catch(() => ({ staff: [], summary: {} }));
      setStaffOptions(staffOut.staff ?? []);
    })();
  }, [ensureAuth]);

  useEffect(() => {
    if (!token) return;
    void loadLeads(token, 0, query);
  }, [token, query, listTab, filterStatus, filterSource, filterChannel, loadLeads]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
    setOffset(0);
    setSelectedIds(new Set());
  }

  async function goPage(nextOffset: number) {
    if (!token || nextOffset < 0 || nextOffset >= total) return;
    await loadLeads(token, nextOffset, query);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!token || !bulkOwnerId || !selectedList.length) return;
    const staff = staffOptions.find((row) => String(row.id) === bulkOwnerId);
    if (!staff) return;
    setBulkBusy(true);
    setError('');
    try {
      await bulkAssignLeads(token, {
        lead_ids: selectedList,
        owner_id: staff.id,
        reason: 'Bulk assign from /crm/leads',
      });
      setSelectedIds(new Set());
      await loadLeads(token, offset, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign thất bại');
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);
  const leadIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const showScores = useMemo(
    () => aiCopilotEnabled() && isAiPilotUser(user?.id),
    [user?.id],
  );
  const { scores: scoreMap, pending: scoresPending } = useLeadScoresMap(token, leadIds, showScores);

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <div className="crm-leads-page__head">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Quản lý Lead</h2>
          <div className="crm-leads-page__head-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {canCreate ? (
              <Link href="/crm/leads/new" className="btn btn-sm">
                + Tạo lead
              </Link>
            ) : null}
            {token ? (
              <CrmLeadsImportExport
              token={token}
              query={query}
              selectedIds={selectedList}
              canImport={canImport}
              onImported={() => void loadLeads(token, 0, query)}
              onError={setError}
            />
            ) : null}
          </div>
        </div>

        <form onSubmit={onSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="search"
            placeholder="Tìm tên, SĐT, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: '1 1 220px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.55rem 0.75rem',
              color: 'var(--text)',
            }}
          />
          <select
            className="kpi-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Lọc trạng thái"
          >
            <option value="">Trạng thái</option>
            {['moi', 'da_lien_he', 'dang_tu_van', 'chot', 'lost'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="kpi-input"
            placeholder="Nguồn"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Lọc nguồn"
          />
          <input
            className="kpi-input"
            placeholder="Kênh"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            aria-label="Lọc kênh"
          />
          <button className="btn btn-sm" type="submit" disabled={loading}>
            Lọc
          </button>
        </form>

        <div className="crm-leads-tabs" role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {(
            [
              ['all', 'Tất cả'],
              ['mine', 'Của tôi'],
              ['unassigned', 'Chưa phân'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`btn btn-sm${listTab === id ? '' : ' btn-secondary'}`}
              onClick={() => {
                setListTab(id);
                setOffset(0);
                setSelectedIds(new Set());
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedList.length && canImport ? (
          <div className="crm-leads-bulk-toolbar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <select
              className="kpi-select"
              value={bulkOwnerId}
              onChange={(e) => setBulkOwnerId(e.target.value)}
              aria-label="Chọn owner bulk assign"
            >
              <option value="">Gán owner…</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              disabled={bulkBusy || !bulkOwnerId}
              onClick={() => void handleBulkAssign()}
            >
              Bulk assign ({selectedList.length})
            </button>
          </div>
        ) : null}

        <p className="muted" style={{ marginTop: 0 }}>
          {total.toLocaleString('vi-VN')} leads · trang {Math.floor(offset / PAGE_SIZE) + 1} /{' '}
          {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          {selectedList.length ? ` · đã chọn ${selectedList.length}` : ''}
        </p>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <PullToRefresh
          disabled={loading || !token}
          onRefresh={async () => {
            if (!token) return;
            await loadLeads(token, offset, query);
          }}
        >
          <CrmLeadsList
            rows={rows}
            loading={loading}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            showScores={showScores}
            scoreMap={scoreMap}
            scoresPending={scoresPending}
          />
        </PullToRefresh>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={loading || offset <= 0}
            onClick={() => void goPage(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Trước
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={loading || offset + PAGE_SIZE >= total}
            onClick={() => void goPage(offset + PAGE_SIZE)}
          >
            Sau →
          </button>
        </div>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmLeadsImportExport } from '@/components/crm/CrmLeadsImportExport';
import { CrmLeadsList } from '@/components/crm/CrmLeadsList';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import {
  BulkActionBar,
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  PageFooter,
  PageToolbar,
  SegmentedControl,
  StaffPageShell,
} from '@/components/layout';
import { fetchLeads, bulkAssignLeads, fetchCrmStaffList, fetchReviewQueueCount, staffMe, staffRefresh } from '@/lib/api';
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

type LeadKindFilter = 'pipeline' | 'review' | 'all';

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
  const [leadKind, setLeadKind] = useState<LeadKindFilter>('pipeline');
  const [reviewQueueCount, setReviewQueueCount] = useState<number | null>(null);
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
  const canReviewQueue = useMemo(() => hasCap(user, 'crm_leads', 'assign'), [user]);

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
        const ownerId = listTab === 'mine' && user?.id ? Number(user.id) : undefined;
        const data = await fetchLeads(accessToken, {
          q: search || undefined,
          status: filterStatus || undefined,
          source: filterSource || undefined,
          channel: filterChannel || undefined,
          owner_id: ownerId,
          unassigned_only: listTab === 'unassigned',
          review_queue_only: leadKind === 'review' ? true : undefined,
          hide_review_queue: leadKind === 'all' ? false : undefined,
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
    [filterChannel, filterSource, filterStatus, leadKind, listTab, user?.id],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'review') setLeadKind('review');
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      const [staffOut, reviewOut] = await Promise.all([
        fetchCrmStaffList(access).catch(() => ({ staff: [], summary: {} })),
        canReviewQueue
          ? fetchReviewQueueCount(access).catch(() => ({ count: 0 }))
          : Promise.resolve({ count: 0 }),
      ]);
      setStaffOptions(staffOut.staff ?? []);
      setReviewQueueCount(reviewOut.count ?? 0);
    })();
  }, [ensureAuth, canReviewQueue]);

  useEffect(() => {
    if (!token) return;
    void loadLeads(token, 0, query);
  }, [token, query, listTab, leadKind, filterStatus, filterSource, filterChannel, loadLeads]);

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

  const pageMeta = useMemo(() => {
    const parts = [
      `${total.toLocaleString('vi-VN')} leads`,
      `trang ${Math.floor(offset / PAGE_SIZE) + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`,
    ];
    if (leadKind === 'pipeline') parts.push('ẩn Phải tra soát');
    else if (leadKind === 'review') parts.push('chỉ Phải tra soát');
    if (selectedList.length) parts.push(`đã chọn ${selectedList.length}`);
    return parts.join(' · ');
  }, [total, offset, leadKind, selectedList.length]);

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading width="wide">
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="wide"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: 'Quản lý Lead' },
      ]}
    >
      <PageToolbar
          title="Quản lý Lead"
          subtitle={pageMeta}
          actions={
            <>
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
              {canCreate ? (
                <Link href="/crm/leads/new" className="btn btn-sm">
                  + Tạo lead
                </Link>
              ) : null}
            </>
          }
        />

        <div className="page-card stack-gap">
          <SegmentedControl
            options={[
              { id: 'all', label: 'Tất cả' },
              { id: 'mine', label: 'Của tôi' },
              { id: 'unassigned', label: 'Chưa phân' },
            ]}
            value={listTab}
            onChange={(id) => {
              setListTab(id);
              setOffset(0);
              setSelectedIds(new Set());
            }}
          />

          <SegmentedControl
            label="Loại lead"
            options={[
              { id: 'pipeline', label: 'Pipeline AM' },
              {
                id: 'review',
                label: 'Phải tra soát',
                badge: reviewQueueCount && reviewQueueCount > 0 ? reviewQueueCount : undefined,
              },
              { id: 'all', label: 'Tất cả (có tag)' },
            ]}
            value={leadKind}
            onChange={(id) => {
              setLeadKind(id);
              setOffset(0);
              setSelectedIds(new Set());
            }}
            className="segmented-control--kind"
          />

          <FilterBar onSubmit={onSearch}>
            <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên, SĐT, email…" />
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
            <FilterBarActions>
              {canReviewQueue ? (
                <Link href="/crm/leads/review-queue" className="btn btn-sm btn-ghost">
                  Inbox GDKD →
                </Link>
              ) : null}
              <button className="btn btn-sm btn-secondary" type="submit" disabled={loading}>
                Lọc
              </button>
            </FilterBarActions>
          </FilterBar>

          {canImport ? (
            <BulkActionBar count={selectedList.length}>
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
                Bulk assign
              </button>
            </BulkActionBar>
          ) : null}

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

          <PageFooter meta={`Hiển thị ${rows.length} / ${total.toLocaleString('vi-VN')} leads`}>
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
          </PageFooter>
        </div>
    </StaffPageShell>
  );
}

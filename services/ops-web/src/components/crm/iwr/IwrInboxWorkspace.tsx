'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createIwrReport,
  fetchIwrInbox,
  fetchIwrReport,
  markIwrViewed,
  type IwrInboxBox,
  type IwrReportDetail,
  type IwrReportRow,
} from '@/lib/crm/iwr-api';
import { iwrAvatarTone, iwrInitials } from './iwr-format';
import {
  INBOX_COUNT_BOXES,
  INBOX_FOLDERS,
  INBOX_KINDS,
  INBOX_LABELS,
  type IwrInboxKind,
  type IwrInboxLabel,
  type IwrInboxPeriod,
  type IwrInboxSort,
  iwrInboxClock,
  iwrInboxMatchesKind,
  iwrInboxMatchesLabel,
  iwrInboxMatchesPeriod,
  iwrInboxMatchesProject,
  iwrInboxPreview,
  iwrInboxProject,
  iwrInboxSortRows,
  iwrInboxStatusBadge,
} from './iwr-inbox';
import { useIwrB2bProjects } from './useIwrB2bProjects';
import { iwrB2bProjectOptionLabel } from './iwr-b2b-project';
import { IwrInboxDetail } from './IwrInboxDetail';

const BOXES = new Set<IwrInboxBox>(INBOX_FOLDERS.map((f) => f.id));

type IwrInboxWorkspaceProps = {
  token: string;
  canWrite: boolean;
  canReview: boolean;
  error: string;
  onError: (message: string) => void;
};

export function IwrInboxWorkspace({ token, canWrite, canReview, error, onError }: IwrInboxWorkspaceProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { projects: b2bProjects, catalog } = useIwrB2bProjects(token);
  const initialBox = params.get('box') as IwrInboxBox | null;
  const initialId = params.get('id');

  const [box, setBox] = useState<IwrInboxBox>(initialBox && BOXES.has(initialBox) ? initialBox : 'action');
  const [kind, setKind] = useState<IwrInboxKind>('all');
  const [period, setPeriod] = useState<IwrInboxPeriod>('all');
  const [sort, setSort] = useState<IwrInboxSort>('newest');
  const [label, setLabel] = useState<IwrInboxLabel | null>(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [items, setItems] = useState<IwrReportRow[]>([]);
  const [counts, setCounts] = useState<Partial<Record<IwrInboxBox, number>>>({});
  const [selectedId, setSelectedId] = useState(initialId ?? '');
  const [detail, setDetail] = useState<IwrReportDetail | null>(null);
  const [listReady, setListReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const syncUrl = useCallback(
    (nextBox: IwrInboxBox, nextId: string) => {
      const qs = new URLSearchParams();
      qs.set('box', nextBox);
      if (nextId) qs.set('id', nextId);
      router.replace(`/crm/internal-reports/inbox?${qs}`, { scroll: false });
    },
    [router],
  );

  const reloadList = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrInbox(token, box);
      setItems(out.items ?? []);
      setListReady(true);
    } catch (err) {
      setListReady(true);
      onError(err instanceof Error ? err.message : 'Tải hộp thư thất bại');
    }
  }, [token, box, onError]);

  const reloadCounts = useCallback(async () => {
    if (!token) return;
    const pairs = await Promise.all(
      INBOX_COUNT_BOXES.map(async (id) => {
        try {
          const out = await fetchIwrInbox(token, id);
          return [id, out.items?.length ?? 0] as const;
        } catch {
          return [id, 0] as const;
        }
      }),
    );
    setCounts(Object.fromEntries(pairs));
  }, [token]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!token || !id) {
        setDetail(null);
        return;
      }
      try {
        const report = await fetchIwrReport(token, id);
        setDetail(report);
        if (!report.first_viewed_at) {
          void markIwrViewed(token, id)
            .then((out) => {
              setDetail((prev) => (prev && prev.id === id ? { ...prev, first_viewed_at: out.first_viewed_at } : prev));
              setItems((prev) => prev.map((row) => (row.id === id ? { ...row, first_viewed_at: out.first_viewed_at } : row)));
            })
            .catch(() => undefined);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
      }
    },
    [token, onError],
  );

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    void reloadCounts();
  }, [reloadCounts]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const projects = useMemo(
    () => b2bProjects.slice().sort((a, b) => a.code.localeCompare(b.code, 'vi')),
    [b2bProjects],
  );

  const visible = useMemo(() => {
    const filtered = items.filter((row) => {
      if (!iwrInboxMatchesKind(row, kind)) return false;
      if (!iwrInboxMatchesPeriod(row, period)) return false;
      if (!iwrInboxMatchesLabel(row, label)) return false;
      if (!iwrInboxMatchesProject(row, projectFilter, catalog)) return false;
      return true;
    });
    return iwrInboxSortRows(filtered, sort);
  }, [items, kind, period, label, projectFilter, sort, catalog]);

  useEffect(() => {
    if (!listReady || !visible.length) return;
    if (!selectedId || !visible.some((row) => row.id === selectedId)) {
      setSelectedId(visible[0].id);
      syncUrl(box, visible[0].id);
    }
  }, [listReady, visible, selectedId, box, syncUrl]);

  function changeBox(next: IwrInboxBox) {
    setBox(next);
    setLabel(null);
    setItems([]);
    setListReady(false);
    setSelectedId('');
    setDetail(null);
    syncUrl(next, '');
  }

  function selectRow(id: string) {
    setSelectedId(id);
    syncUrl(box, id);
  }

  async function create(template: 'daily_work' | 'weekly_work') {
    if (!token || !canWrite) return;
    setBusy(true);
    try {
      const created = await createIwrReport(token, { template_code: template });
      router.push(`/crm/internal-reports/${created.id}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tạo báo cáo thất bại');
    } finally {
      setBusy(false);
      setCreateOpen(false);
    }
  }

  const actionCount = counts.action ?? items.length;

  return (
    <div className="iwr-inbox">
      <div className="iwr-pagehead">
        <div>
          <div className="iwr-crumb">Báo cáo công việc / Hộp thư Báo cáo</div>
          <h1 className="iwr-h1">Hộp thư Báo cáo</h1>
          <p className="iwr-sub">
            ({actionCount} báo cáo cần xử lý)
          </p>
        </div>
        {canWrite && (
          <div className="iwr-pagehead__actions">
            <div className="iwr-more">
              <button type="button" className="iwr-btn iwr-btn--primary" disabled={busy} onClick={() => setCreateOpen((v) => !v)}>
                + Tạo báo cáo
              </button>
              {createOpen && (
                <ul className="iwr-more__menu">
                  <li>
                    <button type="button" onClick={() => void create('daily_work')}>
                      Báo cáo ngày
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => void create('weekly_work')}>
                      Báo cáo tuần
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="iwr-err">{error}</p>}

      <div className="iwr-inbox__grid">
        <aside className="iwr-inbox__folders">
          <div className="iwr-inbox__group">Hộp thư</div>
          {INBOX_FOLDERS.map((folder) => {
            const count = counts[folder.id];
            return (
              <button
                key={folder.id}
                type="button"
                role="tab"
                aria-selected={box === folder.id}
                className={`iwr-folder${box === folder.id ? ' is-active' : ''}`}
                onClick={() => changeBox(folder.id)}
              >
                <span>{folder.label}</span>
                {count != null && count > 0 && <span className="iwr-folder__n">{count}</span>}
              </button>
            );
          })}
          <div className="iwr-inbox__group">Nhãn</div>
          {INBOX_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`iwr-label iwr-label--${item.tone}${label === item.id ? ' is-active' : ''}`}
              onClick={() => setLabel((cur) => (cur === item.id ? null : item.id))}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <section className="iwr-inbox__list">
          <div className="iwr-tabs" role="tablist">
            {INBOX_KINDS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={kind === tab.id}
                className={`iwr-tab${kind === tab.id ? ' is-active' : ''}`}
                onClick={() => setKind(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="iwr-inbox__filters">
            <select className="iwr-input" value={period} onChange={(e) => setPeriod(e.target.value as IwrInboxPeriod)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="all">Mọi lúc</option>
            </select>
            <select className="iwr-input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">Tất cả dự án PTT</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {iwrB2bProjectOptionLabel(project)}
                </option>
              ))}
            </select>
            <select className="iwr-input" value={sort} onChange={(e) => setSort(e.target.value as IwrInboxSort)}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="rag">Theo RAG</option>
            </select>
          </div>
          <div className="iwr-inbox__rows">
            {visible.map((row) => {
              const badge = iwrInboxStatusBadge(row.status, row.rag);
              const project = iwrInboxProject(row, catalog);
              const unread = !row.first_viewed_at && row.status !== 'draft';
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`iwr-msg${selectedId === row.id ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                  onClick={() => selectRow(row.id)}
                >
                  <span className={iwrAvatarTone(row.author_staff_id)}>{iwrInitials(row.author_name)}</span>
                  <div className="iwr-msg__main">
                    <div className="iwr-msg__top">
                      <strong>{row.author_name ?? `NV #${row.author_staff_id}`}</strong>
                      <span className="iwr-muted">{iwrInboxClock(row.submitted_at || row.due_at)}</span>
                    </div>
                    <div className="iwr-msg__title">
                      {unread && <span className="iwr-dot" />}
                      {row.title}
                    </div>
                    {project && <span className="iwr-chip">{project}</span>}
                    <p className="iwr-msg__preview">{iwrInboxPreview(row) || row.template_name_vi}</p>
                  </div>
                  {badge && <span className={`iwr-pill iwr-pill--${badge.tone}`}>{badge.text}</span>}
                </button>
              );
            })}
            {!visible.length && <div className="iwr-empty">Không có báo cáo trong mục này</div>}
          </div>
        </section>

        <section className="iwr-inbox__detail">
          {detail ? (
            <IwrInboxDetail
              token={token}
              report={detail}
              canReview={canReview}
              onReload={async () => {
                await Promise.all([reloadList(), loadDetail(detail.id), reloadCounts()]);
              }}
              onError={onError}
            />
          ) : (
            <div className="iwr-empty">Chọn một báo cáo để xem</div>
          )}
        </section>
      </div>
    </div>
  );
}

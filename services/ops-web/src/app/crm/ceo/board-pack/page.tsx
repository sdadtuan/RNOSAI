'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import { ceoCommandEnabled } from '@/lib/crm/ceo-command-flags';
import { canSeeCeoNav } from '@/lib/crm/ceo-command-thread.util';
import {
  fetchCeoTowerBoardPack,
  type TowerCapacityRow,
  type TowerException,
  type TowerFinanceCell,
} from '@/lib/crm/ceo-tower-api';
import { TOWER_COLUMN_DEFS } from '@/lib/crm/ceo-tower-ui.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

type KStripItem = {
  key: string;
  value: number | null;
  status: string;
};

type ColumnFact = {
  column_id: string;
  red_count: number;
  amber_count: number;
  header_severity?: string;
};

type DepartmentFact = {
  code: string;
  label_vi: string;
  red_count: number;
  amber_count: number;
  outside_cycle?: boolean;
};

type BoardPackFacts = {
  week?: string;
  k_strip?: KStripItem[];
  columns?: ColumnFact[];
  departments?: DepartmentFact[];
  top_exceptions?: TowerException[];
  finance?: TowerFinanceCell[];
  capacity_top?: TowerCapacityRow[];
  s11_fail?: boolean;
  s12_fail?: boolean;
  degraded?: Array<{ source: string; reason: string }>;
  decisions_blank?: string[];
};

function formatFinanceValue(key: string, value: number | null): string {
  if (value == null) return '—';
  if (key === 'top1' || key === 'gm') return `${value}%`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  return String(value);
}

function statusLabel(status: string): string {
  if (status === 'red') return 'đỏ';
  if (status === 'amber') return 'vàng';
  if (status === 'green') return 'xanh';
  return '—';
}

function BoardPackPrintBody({ facts, week, generatedAt }: {
  facts: BoardPackFacts;
  week: string;
  generatedAt: string;
}) {
  const columnsById = new Map((facts.columns ?? []).map((col) => [col.column_id, col]));
  const decisions = facts.decisions_blank ?? ['', '', ''];

  return (
    <article className="board-pack-sheet" data-testid="ceo-board-pack-sheet">
      <header className="board-pack-header">
        <h1>Board pack tuần {week}</h1>
        <p className="board-pack-meta">
          Tháp chu trình PTT · sinh {new Date(generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
        </p>
      </header>

      {facts.k_strip?.length ? (
        <section className="board-pack-section">
          <h2>Chỉ số K</h2>
          <div className="board-pack-k-grid">
            {facts.k_strip.map((item) => (
              <div key={item.key} className="board-pack-k-cell">
                <strong>{item.key.toUpperCase()}</strong>
                <span>{item.value != null ? item.value : '—'}</span>
                <small>{statusLabel(item.status)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="board-pack-section">
        <h2>Sót theo cột</h2>
        <table className="board-pack-table">
          <thead>
            <tr>
              <th>Cột</th>
              <th>Đỏ</th>
              <th>Vàng</th>
            </tr>
          </thead>
          <tbody>
            {TOWER_COLUMN_DEFS.map((def) => {
              const col = columnsById.get(def.id);
              return (
                <tr key={def.id}>
                  <td>{def.label}</td>
                  <td>{col?.red_count ?? 0}</td>
                  <td>{col?.amber_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {facts.departments?.length ? (
        <section className="board-pack-section">
          <h2>Sót theo phòng</h2>
          <table className="board-pack-table">
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Đỏ</th>
                <th>Vàng</th>
              </tr>
            </thead>
            <tbody>
              {facts.departments.map((dept) => (
                <tr key={dept.code}>
                  <td>
                    {dept.label_vi}
                    {dept.outside_cycle ? ' (ngoài chu trình)' : ''}
                  </td>
                  <td>{dept.red_count}</td>
                  <td>{dept.amber_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {facts.finance?.length ? (
        <section className="board-pack-section">
          <h2>Tiền</h2>
          <div className="board-pack-finance-grid">
            {facts.finance.map((cell) => (
              <div key={cell.key} className="board-pack-finance-cell">
                <strong>{cell.label_vi}</strong>
                <span>{formatFinanceValue(cell.key, cell.value)}</span>
                <small>{statusLabel(cell.status)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="board-pack-section board-pack-inline">
        <p>
          <strong>S11 fail:</strong> {facts.s11_fail ? 'Có' : 'Không'}
        </p>
        <p>
          <strong>S12 fail:</strong> {facts.s12_fail ? 'Có' : 'Không'}
        </p>
      </section>

      {facts.capacity_top?.length ? (
        <section className="board-pack-section">
          <h2>Quá tải (top 5)</h2>
          <table className="board-pack-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Phòng</th>
                <th>Đỏ</th>
                <th>Vàng</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {facts.capacity_top.map((row) => (
                <tr key={row.staff_id}>
                  <td>{row.name}</td>
                  <td>{row.department_code || '—'}</td>
                  <td>{row.red_owned}</td>
                  <td>{row.amber_owned}</td>
                  <td>{row.flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="board-pack-section">
        <h2>Top 10 sót</h2>
        {(facts.top_exceptions ?? []).length === 0 ? (
          <p>Không sót trong cửa sổ.</p>
        ) : (
          <table className="board-pack-table">
            <thead>
              <tr>
                <th>Nhà máy</th>
                <th>Việc</th>
                <th>Tuổi</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {(facts.top_exceptions ?? []).map((row) => (
                <tr key={`${row.entity_type}-${row.entity_id}-${row.column_id}-${row.title_vi}`}>
                  <td>{row.factory}</td>
                  <td>{row.title_vi}</td>
                  <td>{row.age_label}</td>
                  <td>{row.owner_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {facts.degraded?.length ? (
        <section className="board-pack-section">
          <h2>Degraded</h2>
          <ul className="board-pack-degraded">
            {facts.degraded.map((item) => (
              <li key={`${item.source}-${item.reason}`}>
                {item.source}: {item.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="board-pack-section board-pack-decisions">
        <h2>Quyết định tuần</h2>
        {decisions.map((line, index) => (
          <p key={index} className="board-pack-decision-line">
            Quyết định tuần: {line || '___'}
          </p>
        ))}
      </section>
    </article>
  );
}

export default function CeoBoardPackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get('week') ?? '';

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [facts, setFacts] = useState<BoardPackFacts | null>(null);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!ceoCommandEnabled()) {
      setError('CEO Command đang tắt trên môi trường này');
      return null;
    }
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
      if (!canSeeCeoNav(me)) {
        router.replace(`/403?from=${encodeURIComponent('/crm/ceo/board-pack')}`);
        return null;
      }
      setToken(access);
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
      if (!canSeeCeoNav(me)) {
        router.replace(`/403?from=${encodeURIComponent('/crm/ceo/board-pack')}`);
        return null;
      }
      setToken(access);
      return access;
    }
  }, [router]);

  const load = useCallback(async (access: string) => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchCeoTowerBoardPack(access, weekParam || undefined);
      setWeek(out.week);
      setGeneratedAt(out.generated_at);
      setFacts(out.facts_json as BoardPackFacts);
    } catch {
      setError('Không tải được board pack');
      setFacts(null);
    } finally {
      setLoading(false);
    }
  }, [weekParam]);

  useEffect(() => {
    void ensureAuth().then((access) => {
      if (access) void load(access);
    });
  }, [ensureAuth, load]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Điều hành CEO', href: '/crm/ceo' },
        { label: 'Board pack tuần' },
      ]}
    >
      <PageToolbar
        title="Board pack tuần"
        subtitle="Một trang in cho họp CEO–GDKD — mọi số lấy từ facts_json."
      />
      <div className="page-card stack-gap board-pack-screen" data-testid="ceo-board-pack-page">
        <div className="board-pack-actions no-print">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            In / PDF trình duyệt
          </button>
          <Link href="/crm/ceo" className="btn btn-secondary">
            ← Tháp chu trình
          </Link>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {loading && !facts ? <p className="muted">Đang tải board pack…</p> : null}
        {facts ? (
          <BoardPackPrintBody facts={facts} week={week} generatedAt={generatedAt} />
        ) : null}
      </div>
      <style jsx global>{`
        .board-pack-screen {
          max-width: 960px;
        }
        .board-pack-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .board-pack-sheet {
          display: grid;
          gap: 0.75rem;
          font-size: 0.85rem;
        }
        .board-pack-header h1 {
          font-size: 1.25rem;
          margin: 0;
        }
        .board-pack-meta {
          margin: 0.25rem 0 0;
          color: var(--muted, #666);
        }
        .board-pack-section h2 {
          font-size: 0.95rem;
          margin: 0 0 0.35rem;
        }
        .board-pack-k-grid,
        .board-pack-finance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 0.35rem;
        }
        .board-pack-k-cell,
        .board-pack-finance-cell {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 0.35rem 0.5rem;
          display: grid;
          gap: 0.15rem;
        }
        .board-pack-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .board-pack-table th,
        .board-pack-table td {
          border: 1px solid #ddd;
          padding: 0.25rem 0.4rem;
          text-align: left;
        }
        .board-pack-inline {
          display: flex;
          gap: 1.5rem;
        }
        .board-pack-inline p {
          margin: 0;
        }
        .board-pack-degraded {
          margin: 0;
          padding-left: 1.1rem;
        }
        .board-pack-decision-line {
          margin: 0.35rem 0;
          border-bottom: 1px solid #ccc;
          min-height: 1.4rem;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print,
          nav,
          header:not(.board-pack-header),
          .page-toolbar,
          .staff-shell-sidebar,
          .staff-shell-topbar {
            display: none !important;
          }
          .board-pack-screen {
            max-width: none;
            box-shadow: none;
            border: none;
            padding: 0;
          }
          .board-pack-sheet {
            gap: 0.45rem;
            font-size: 9pt;
          }
          .board-pack-table th,
          .board-pack-table td {
            padding: 0.15rem 0.25rem;
          }
        }
      `}</style>
    </StaffPageShell>
  );
}

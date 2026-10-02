'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
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
import {
  confirmP13Hours,
  fetchP13Groups,
  fetchP13Service,
  fetchP13Services,
  importP13Seed,
  patchP13Item,
  type P13GroupRow,
  type P13Item,
  type P13ServiceDetail,
  type P13ServiceRow,
} from '@/lib/p13/api';
import { canManageP13Catalog, canManageP13Holidays, p13Enabled } from '@/lib/p13/flags';
import './catalog.css';

const LEVELS = [
  { code: 'basic', name: 'Cơ bản', rank: 1 },
  { code: 'standard', name: 'Tiêu chuẩn', rank: 2 },
  { code: 'advanced', name: 'Nâng cao', rank: 3 },
] as const;
const TABS = ['Hạng mục', 'Đầu vào', 'Bàn giao', 'KPI', 'Rủi ro', 'Phạm vi theo cấp'] as const;
const UNIT: Record<string, string> = { times: 'lần', month: 'tháng', shoot_day: 'ngày quay' };

function hoursLabel(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function ServiceCatalog() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [groups, setGroups] = useState<P13GroupRow[]>([]);
  const [services, setServices] = useState<P13ServiceRow[]>([]);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [detail, setDetail] = useState<P13ServiceDetail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Hạng mục');
  const [level, setLevel] = useState<(typeof LEVELS)[number]['code']>('standard');
  const [phase, setPhase] = useState('');
  const [gatesOnly, setGatesOnly] = useState(false);
  const [drawer, setDrawer] = useState<P13Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importSeed, setImportSeed] = useState<unknown>(null);
  const [importSummary, setImportSummary] = useState('');
  const [notice, setNotice] = useState('');

  const ensureAuth = useCallback(async (): Promise<{ token: string; me: StoredStaffUser } | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      updateStoredUser(me);
      return { token: access, me };
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
      updateStoredUser(me);
      return { token: access, me };
    }
  }, [router]);

  const loadDetail = useCallback(async (access: string, serviceCode: string) => {
    setDetail(await fetchP13Service(access, serviceCode));
  }, []);

  useEffect(() => {
    const cached = getStoredUser();
    if (cached) setUser(cached);
    void (async () => {
      const auth = await ensureAuth();
      if (!auth) return;
      setUser(auth.me);
      setToken(auth.token);
      if (!p13Enabled(auth.me)) {
        setDisabled(true);
        setLoading(false);
        return;
      }
      if (!hasCap(auth.me, 'p13_catalog', 'view') && !hasCap(auth.me, 'p13_catalog', 'manage')) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      try {
        const [groupRows, serviceRows] = await Promise.all([fetchP13Groups(auth.token), fetchP13Services(auth.token)]);
        setGroups(groupRows);
        setServices(serviceRows);
        const first = serviceRows[0]?.code ?? '';
        setCode(first);
        if (first) await loadDetail(auth.token, first);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) setDisabled(true);
        else if (status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : 'Không tải được danh mục');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadDetail]);

  const manage = canManageP13Catalog(user);
  const filteredServices = services.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });
  const rank = LEVELS.find((row) => row.code === level)?.rank ?? 2;
  const visibleItems = useMemo(() => {
    const items = detail?.items ?? [];
    return items.filter((item) => {
      const itemRank = LEVELS.find((row) => row.code === item.min_level)?.rank ?? 9;
      if (itemRank > rank) return false;
      if (phase && item.phase_code !== phase) return false;
      if (gatesOnly && !item.approval_gate) return false;
      return true;
    });
  }, [detail, rank, phase, gatesOnly]);

  async function choose(next: string) {
    setCode(next);
    setError('');
    try {
      await loadDetail(token, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dịch vụ');
    }
  }

  async function saveItem(item: P13Item, patch: Record<string, unknown>) {
    try {
      await patchP13Item(token, item.code, patch);
      setNotice('Đã lưu. Giá gói tính lại khi có version giá nháp.');
      await loadDetail(token, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được hạng mục');
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      width="wide"
      loading={loading}
      breadcrumb={[{ label: 'Bán hàng', href: '/crm/proposals' }, { label: 'Danh mục dịch vụ' }]}
    >
      <div className="p13-head">
        <div>
          <h1 style={{ margin: 0 }}>Danh mục dịch vụ</h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {detail?.catalog_version ? `Phiên bản danh mục ${detail.catalog_version}` : 'Danh mục P13'}
          </p>
        </div>
        {manage ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canManageP13Holidays(user) ? <Link className="btn btn-sm" href="/admin/p13/holidays">Ngày lễ</Link> : null}
            <button className="btn btn-sm" type="button" onClick={() => { setImportOpen(true); setImportStep(1); }}>Import seed JSON</button>
          </div>
        ) : null}
      </div>

      {disabled ? <p className="p13-banner">Mục Danh mục dịch vụ chưa bật. Đặt P13_ENABLED=true trên API.</p> : null}
      {forbidden ? (
        <div className="card">
          <h2>Bạn không có quyền xem mục này</h2>
          <p>Cần quyền p13.catalog.view.</p>
          <Link className="btn" href="/">Về Tổng quan</Link>
        </div>
      ) : null}
      {error ? <p className="error">{error} <button className="btn btn-sm" type="button" onClick={() => code && void choose(code)}>Thử lại</button></p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      {loading ? (
        <div className="p13-main">{[1, 2, 3, 4].map((n) => <div key={n} className="p13-skel" />)}</div>
      ) : null}

      {!loading && !disabled && !forbidden && services.length === 0 ? (
        <div className="card">
          <p>Chưa có danh mục — Admin import p13-seed-v2.json</p>
          {manage ? <button className="btn" type="button" onClick={() => setImportOpen(true)}>Import</button> : null}
        </div>
      ) : null}

      {!loading && !disabled && !forbidden && services.length > 0 ? (
        <>
          <p className="p13-banner">Chưa có version tham số giá active — giá hiển thị “—”. Lưu danh mục được; chưa gửi báo giá theo giá P13.</p>
          <div className="p13-catalog">
            <aside className="p13-side">
              <input className="p13-search" placeholder="Tìm dịch vụ" value={query} onChange={(ev) => setQuery(ev.target.value)} />
              {groups.map((group) => (
                <div key={group.code}>
                  <div className="p13-group">{group.name}</div>
                  {filteredServices.filter((row) => row.group_code === group.code).map((row) => (
                    <button key={row.code} type="button" className={row.code === code ? 'p13-svc is-on' : 'p13-svc'} onClick={() => void choose(row.code)}>
                      <span><strong>{row.code}</strong> {row.name}</span>
                      <span className="muted">{row.item_count}</span>
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            {detail ? (
              <section className="p13-main">
                <p className="muted" style={{ marginTop: 0 }}>{detail.group_name} · {detail.billing_model || '—'}</p>
                <h2 style={{ margin: '0.2rem 0' }}>{detail.name}</h2>
                <p>{detail.objective || '—'}</p>
                <div className="p13-cards">
                  {LEVELS.map((row) => (
                    <article key={row.code} className="p13-card">
                      <div className="muted">{row.name}</div>
                      <strong>{hoursLabel(detail.package_hours[row.code]?.hours ?? '0')} giờ</strong>
                      <div>Giá bán: —</div>
                    </article>
                  ))}
                </div>
                <div className="p13-tabs">
                  {TABS.map((name) => (
                    <button key={name} type="button" className={tab === name ? 'p13-tab is-on' : 'p13-tab'} onClick={() => setTab(name)}>
                      {name}{name === 'Hạng mục' ? ` (${detail.items.length})` : ''}
                    </button>
                  ))}
                </div>
                {tab === 'Hạng mục' ? (
                  <>
                    <div className="p13-filters">
                      {LEVELS.map((row) => {
                        const count = detail.items.filter((item) => (LEVELS.find((lv) => lv.code === item.min_level)?.rank ?? 9) <= row.rank).length;
                        return (
                          <button key={row.code} type="button" className={level === row.code ? 'p13-tab is-on' : 'p13-tab'} onClick={() => setLevel(row.code)}>
                            {row.name} {count}
                          </button>
                        );
                      })}
                      <select className="p13-field" style={{ width: 'auto' }} value={phase} onChange={(ev) => setPhase(ev.target.value)}>
                        <option value="">Mọi giai đoạn</option>
                        {detail.phases.map((row) => <option key={row.code} value={row.code}>{row.code} · {row.name}</option>)}
                      </select>
                      <label><input type="checkbox" checked={gatesOnly} onChange={(ev) => setGatesOnly(ev.target.checked)} /> Chỉ gate</label>
                      {manage ? <button className="btn btn-sm" type="button" onClick={() => void confirmP13Hours(token, code).then(() => loadDetail(token, code))}>Xác nhận giờ</button> : null}
                    </div>
                    <table className="p13-table">
                      <thead>
                        <tr><th>ID</th><th>Hạng mục</th><th>R</th><th>A</th><th>Đầu ra</th><th>Gate</th><th>Cấp</th><th>Giờ</th><th>Đơn vị</th><th>Tính phí</th></tr>
                      </thead>
                      <tbody>
                        {detail.phases.filter((row) => visibleItems.some((item) => item.phase_code === row.code)).map((row) => (
                          <Fragment key={row.code}>
                            <tr className="p13-phase"><td colSpan={10}>{row.code} · {row.name}</td></tr>
                            {visibleItems.filter((item) => item.phase_code === row.code).map((item) => (
                              <tr key={item.code} onClick={() => setDrawer(item)} style={{ cursor: 'pointer' }}>
                                <td>{item.code}</td>
                                <td>{item.task}{item.subtask ? <div className="muted">{item.subtask}</div> : null}</td>
                                <td>{(item.raci?.R ?? []).join(', ')}</td>
                                <td>{(item.raci?.A ?? []).join(', ')}</td>
                                <td>{item.deliverable || '—'}</td>
                                <td>{item.approval_gate ? 'Có' : '—'}</td>
                                <td>{LEVELS.find((lv) => lv.code === item.min_level)?.name}</td>
                                <td>{hoursLabel(item.est_hours)}{item.est_hours_is_assumption ? <span className="p13-badge">Giả định</span> : null}</td>
                                <td>{UNIT[item.unit] || item.unit}</td>
                                <td>{item.billable ? 'Có' : 'Không'}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
                {tab === 'Đầu vào' ? <SimpleTable rows={detail.inputs.map((row) => [row.code, row.name, row.format_or_permission || '—'])} heads={['Mã', 'Tên', 'Định dạng']} /> : null}
                {tab === 'Bàn giao' ? <SimpleTable rows={detail.deliverables.map((row) => [row.code, row.name, row.acceptance_criteria || '—'])} heads={['Mã', 'Tên', 'Nghiệm thu']} /> : null}
                {tab === 'KPI' ? <SimpleTable rows={detail.kpis.map((row) => [row.code, row.name, row.formula || '—'])} heads={['Mã', 'Tên', 'Công thức']} /> : null}
                {tab === 'Rủi ro' ? <SimpleTable rows={detail.risks.map((row) => [row.code, row.risk, row.mitigation || '—'])} heads={['Mã', 'Rủi ro', 'Giảm thiểu']} /> : null}
                {tab === 'Phạm vi theo cấp' ? <SimpleTable rows={detail.scope.map((row) => [row.feature, row.basic_text || '—', row.standard_text || '—', row.advanced_text || '—'])} heads={['Hạng mục', 'Cơ bản', 'Tiêu chuẩn', 'Nâng cao']} /> : null}
              </section>
            ) : null}
          </div>
        </>
      ) : null}

      {drawer ? (
        <div className="p13-drawer" onClick={() => setDrawer(null)}>
          <aside className="p13-panel" onClick={(ev) => ev.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{drawer.code}</h3>
            <p>{drawer.task}</p>
            <p><strong>Tiêu chuẩn đạt:</strong> {drawer.standard || '—'}</p>
            <p><strong>C/I:</strong> {(drawer.raci?.C ?? []).join(', ') || '—'} / {(drawer.raci?.I ?? []).join(', ') || '—'}</p>
            <p><strong>Công cụ:</strong> {drawer.tool || '—'}</p>
            {manage ? (
              <form onSubmit={(ev) => { ev.preventDefault(); const data = new FormData(ev.currentTarget); void saveItem(drawer, { est_hours: Number(data.get('hours')), min_level: String(data.get('level')), billable: data.get('billable') === 'on', confirm_hours: data.get('confirm') === 'on' }); }}>
                <label>Giờ<input className="p13-field" name="hours" defaultValue={drawer.est_hours} /></label>
                <label>Cấp<select className="p13-field" name="level" defaultValue={drawer.min_level}>{LEVELS.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
                <label><input name="billable" type="checkbox" defaultChecked={drawer.billable} /> Tính phí</label>
                <label><input name="confirm" type="checkbox" /> Xác nhận giờ</label>
                <button className="btn" type="submit">Lưu</button>
              </form>
            ) : null}
            <button className="btn btn-sm" type="button" onClick={() => setDrawer(null)}>Đóng</button>
          </aside>
        </div>
      ) : null}

      {importOpen ? (
        <div className="p13-modal">
          <div className="p13-dialog">
            <h3 style={{ marginTop: 0 }}>Import seed — bước {importStep}/3</h3>
            {importStep === 1 ? (
              <input type="file" accept="application/json" onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                setImportSeed(JSON.parse(await file.text()) as unknown);
                setImportStep(2);
              }} />
            ) : null}
            {importStep === 2 ? (
              <>
                <button className="btn" type="button" onClick={() => void importP13Seed(token, importSeed, true).then((summary) => { setImportSummary(JSON.stringify(summary, null, 2)); setImportStep(3); }).catch((err) => setError(err instanceof Error ? err.message : 'Import lỗi'))}>Chạy dry-run</button>
                {importSummary ? <pre>{importSummary}</pre> : null}
              </>
            ) : null}
            {importStep === 3 ? (
              <>
                <pre style={{ maxHeight: 220, overflow: 'auto' }}>{importSummary}</pre>
                <p>Áp dụng thay đổi cho danh mục? Checklist đang chạy không bị ảnh hưởng.</p>
                <button className="btn" type="button" onClick={() => void importP13Seed(token, importSeed, false).then(async () => { setImportOpen(false); const serviceRows = await fetchP13Services(token); setServices(serviceRows); if (serviceRows[0]) await choose(serviceRows[0].code); })}>Áp dụng</button>
              </>
            ) : null}
            <button className="btn btn-sm" type="button" onClick={() => setImportOpen(false)}>Đóng</button>
          </div>
        </div>
      ) : null}
    </StaffPageShell>
  );
}

function SimpleTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <table className="p13-table">
      <thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

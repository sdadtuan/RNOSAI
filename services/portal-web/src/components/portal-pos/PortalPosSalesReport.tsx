'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPortalDesk } from '@/lib/api';
import { displayPageName } from '@/components/portal-crm/portal-inbox.util';
import { POS_SOURCE_LABEL, POS_CARRIER_LABEL, posGet, posPost, posUploadCsv, vnd } from '@/lib/portal-pos-api';

type ReportRow = { staff?: string; page_id?: string; source?: string; orders: number; success: number; returned: number; revenue_vnd: number; expected_revenue_vnd?: number; return_rate: number };
type Report = {
  range: string; from: string; revenue_vnd: number; expected_revenue_vnd?: number; cod_vnd: number;
  orders: { total: number; success: number; returned: number; cancelled: number; new: number; from_conversations: number };
  conversations: number; close_rate: number; return_rate: number;
  by_staff: ReportRow[];
  by_page: ReportRow[];
  by_source: ReportRow[];
};

type Statement = { id: string; carrier: string; period: string; filename: string; imported_at: string; line_count: number; matched: number; diffs: number; missing: number; difference_total: number };
type StatementDetail = Statement & { lines: Array<{ tracking_code: string; order_code: string; expected_cod: number; actual_cod: number; fee_vnd: number; payout_vnd: number; difference_vnd: number; match_status: string }> };

export function PortalPosSalesReport({ token, canManage }: { token: string; canManage: boolean }) {
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'month'>('today');
  const [report, setReport] = useState<Report | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [open, setOpen] = useState<StatementDetail | null>(null);
  const [pages, setPages] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');
  const [payout, setPayout] = useState({ tracking_code: '', actual_cod: '', fee_vnd: '', payout_vnd: '', carrier: 'ghn' });

  const load = useCallback(async () => {
    const [r, c, desk] = await Promise.all([
      posGet<Report>(token, `/api/portal/pos/reports/sales?range=${range}`),
      canManage ? posGet<{ statements: Statement[] }>(token, '/api/portal/pos/cod') : Promise.resolve({ statements: [] }),
      fetchPortalDesk(token, { include_inactive: '1' }).catch(() => null),
    ]);
    setReport(r);
    setStatements(c.statements);
    if (desk) {
      const m = new Map<string, string>();
      for (const p of desk.pages) m.set(p.page_id, p.page_name || '');
      setPages(m);
    }
  }, [token, range, canManage]);

  useEffect(() => { void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi')); }, [load]);

  async function onCsv(file: File) {
    try {
      await posUploadCsv(token, '/api/portal/pos/cod/import', file, { carrier: payout.carrier });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không nhập được đối soát'); }
  }

  const pct = (n: number) => `${Math.round((n || 0) * 1000) / 10}%`;

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <h1>Báo cáo bán hàng</h1>
          <p>Doanh thu thực (đơn thành công) và doanh thu dự kiến (đơn đang xử lý). Tỷ lệ chốt và hoàn theo nhân viên, Page và nguồn. Giờ Việt Nam.</p>
        </div>
        <div className="pos-tabs" style={{ border: 0 }}>
          {([['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['month', 'Tháng này']] as const).map(([id, label]) => (
            <button key={id} type="button" className={range === id ? 'pos-tab is-on' : 'pos-tab'} onClick={() => setRange(id)}>{label}</button>
          ))}
        </div>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      {report ? (
        <>
          <div className="pos-kpi">
            <div className="pos-kpi__item"><span>Doanh thu thực</span><strong>{vnd(report.revenue_vnd)}</strong><p className="pos-hint">Đơn thành công</p></div>
            <div className="pos-kpi__item"><span>Doanh thu dự kiến</span><strong>{vnd(report.expected_revenue_vnd ?? 0)}</strong><p className="pos-hint">Đơn chưa hoàn tất (chưa giao thành công, chưa hủy/hoàn)</p></div>
            <div className="pos-kpi__item"><span>Đơn hàng</span><strong>{report.orders.total}</strong><p className="pos-hint">{report.orders.success} thành công · {report.orders.returned} hoàn · {report.orders.cancelled} hủy</p></div>
            <div className="pos-kpi__item"><span>Tỷ lệ chốt</span><strong>{pct(report.close_rate)}</strong><p className="pos-hint">{report.orders.from_conversations} đơn / {report.conversations} hội thoại</p></div>
            <div className="pos-kpi__item"><span>Tỷ lệ hoàn</span><strong>{pct(report.return_rate)}</strong></div>
          </div>
          {(['by_staff', 'by_page', 'by_source'] as const).map((key) => (
            <div key={key} className="pos-card" style={{ marginBottom: 12 }}>
              <h2>{key === 'by_staff' ? 'Theo nhân viên' : key === 'by_page' ? 'Theo Page' : 'Theo nguồn'}</h2>
              <table className="pos-table">
                <thead><tr><th>Nhóm</th><th>Đơn</th><th>Thành công</th><th>Hoàn</th><th>Tỷ lệ hoàn</th><th>Doanh thu thực</th><th>Doanh thu dự kiến</th></tr></thead>
                <tbody>
                  {(report[key] ?? []).map((row, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>
                      <td>{key === 'by_staff' ? row.staff : key === 'by_source' ? (POS_SOURCE_LABEL[row.source || ''] || row.source) : (row.page_id && !row.page_id.startsWith('(') ? displayPageName(row.page_id, pages.get(row.page_id) || '') : (row.page_id || '\u2014'))}</td>
                      <td>{row.orders}</td>
                      <td>{row.success}</td>
                      <td>{row.returned}</td>
                      <td>{pct(row.return_rate)}</td>
                      <td>{vnd(row.revenue_vnd)}</td>
                      <td>{vnd(row.expected_revenue_vnd ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      ) : <p className="pos-hint">Đang tải…</p>}

      {canManage ? (
        <div className="pos-card">
          <h2>Đối soát COD</h2>
          <p className="pos-hint">Nhập sao kê CSV của hãng (cột: Mã vận đơn, Tiền COD, Phí, Thực nhận) hoặc ghi một khoản chi.</p>
          <div className="pos-filters">
            <select className="pos-select" value={payout.carrier} onChange={(e) => setPayout({ ...payout, carrier: e.target.value })}>
              {Object.entries(POS_CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="pos-btn">Nhập CSV sao kê
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
            </label>
          </div>
          <div className="pos-grid pos-grid--form">
            <label className="pos-field">Mã vận đơn<input className="pos-input" value={payout.tracking_code} onChange={(e) => setPayout({ ...payout, tracking_code: e.target.value })} /></label>
            <label className="pos-field">COD thực nhận<input className="pos-input" value={payout.actual_cod} onChange={(e) => setPayout({ ...payout, actual_cod: e.target.value })} /></label>
            <label className="pos-field">Phí<input className="pos-input" value={payout.fee_vnd} onChange={(e) => setPayout({ ...payout, fee_vnd: e.target.value })} /></label>
            <label className="pos-field">Thực chi<input className="pos-input" value={payout.payout_vnd} onChange={(e) => setPayout({ ...payout, payout_vnd: e.target.value })} /></label>
          </div>
          <button type="button" className="pos-btn pos-btn--sm" style={{ marginTop: 8 }} onClick={() => void posPost(token, '/api/portal/pos/cod/payout', { ...payout, actual_cod: Number(payout.actual_cod) || 0, fee_vnd: Number(payout.fee_vnd) || 0, payout_vnd: Number(payout.payout_vnd) || 0 }).then(() => load())}>Ghi khoản chi</button>
          {statements.length ? (
            <table className="pos-table" style={{ marginTop: 16 }}>
              <thead><tr><th>Ngày nhập</th><th>Hãng</th><th>Khớp</th><th>Lệch</th><th>Thiếu</th><th>Tổng lệch</th></tr></thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} onClick={() => void posGet<{ statement: StatementDetail }>(token, `/api/portal/pos/cod/${s.id}`).then((r) => setOpen(r.statement))}>
                    <td>{s.imported_at ? new Date(s.imported_at).toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }) : ''} <div className="pos-hint">{s.filename}</div></td>
                    <td>{POS_CARRIER_LABEL[s.carrier] || s.carrier || '—'}</td>
                    <td>{s.matched}</td>
                    <td>{s.diffs}</td>
                    <td>{s.missing}</td>
                    <td>{vnd(s.difference_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="pos-hint">Chưa có sao kê.</p>}
        </div>
      ) : null}

      {open ? (
        <div className="pos-drawer" onClick={() => setOpen(null)}>
          <div className="pos-drawer__panel" onClick={(e) => e.stopPropagation()}>
            <h2>Sao kê {open.filename}</h2>
            <table className="pos-table">
              <thead><tr><th>Vận đơn</th><th>Đơn</th><th>COD đơn</th><th>COD sao kê</th><th>Lệch</th><th></th></tr></thead>
              <tbody>
                {open.lines.map((l, i) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td>{l.tracking_code}</td>
                    <td>{l.order_code || '—'}</td>
                    <td>{vnd(l.expected_cod)}</td>
                    <td>{vnd(l.actual_cod)}</td>
                    <td>{vnd(l.difference_vnd)}</td>
                    <td><span className={`pos-badge pos-badge--${l.match_status === 'matched' ? 'success' : l.match_status === 'diff' ? 'warn' : 'cancelled'}`}>{l.match_status === 'matched' ? 'Khớp' : l.match_status === 'diff' ? 'Lệch' : 'Thiếu đơn'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

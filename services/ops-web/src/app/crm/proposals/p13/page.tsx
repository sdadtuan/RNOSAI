'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { getAccessToken, getStoredUser } from '@/lib/auth';
import { canApproveP13Quote, canViewP13QuoteMargin, p13QuoteExportEnabled } from '@/lib/p13/flags';

type QuoteRow = {
  id: number;
  quote_code: string;
  status: string;
  p13_approval_status: string;
  client_name?: string;
  validity_days: number | null;
  valid_until: string | null;
  issued_at: string | null;
  display_mode: string;
  needs_approval: boolean;
  approval_reasons: string[];
  warnings: string[];
  blockers: string[];
  missing: string[];
  effective_discount_pct: string | null;
  discount_approval_threshold_pct?: string | null;
  valid_until_if_issued_today?: string | null;
  fee?: string | null;
  total?: string | null;
  margin_pct_effective?: string | null;
  lines: Array<{ line_type: string; description: string; unit: string; qty: string; unit_price: string | null; amount: string | null }>;
  totals: { fee_subtotal: string | null; extra_discount_amount: string | null; fee_vat: string | null; fee_total: string | null; grand_total: string | null } | null;
};

type DraftLine = { line_type: 'package' | 'item' | 'custom'; service_code: string; level_code: string; item_code: string; qty: string; discount_pct: string };

const emptyLine = (): DraftLine => ({ line_type: 'package', service_code: 'WEB', level_code: 'standard', item_code: '', qty: '1', discount_pct: '' });

function money(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function call(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string; details?: { codes?: string[] } } };
  if (!res.ok) {
    const error = new Error(body.error?.message || body.error?.code || 'request_failed') as Error & { code?: string; codes?: string[] };
    error.code = body.error?.code;
    error.codes = body.error?.details?.codes;
    throw error;
  }
  return body.data;
}

export default function P13QuotesPage() {
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [current, setCurrent] = useState<QuoteRow | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [extra, setExtra] = useState('');
  const [days, setDays] = useState('10');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const user = getStoredUser();
  const exportOn = p13QuoteExportEnabled();

  const load = useCallback(async (access: string) => {
    const data = (await call(access, '/api/crm/p13/proposals')) as QuoteRow[];
    setRows(data);
  }, []);

  useEffect(() => {
    const access = getAccessToken() ?? '';
    setToken(access);
    if (access) void load(access).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được'));
  }, [load]);

  async function openQuote(id: number) {
    const data = (await call(token, `/api/crm/p13/proposals/${id}`)) as QuoteRow;
    setCurrent(data);
    setDays(String(data.validity_days ?? 10));
  }

  async function createQuote() {
    const data = (await call(token, '/api/crm/p13/proposals', { method: 'POST', body: JSON.stringify({ title: 'Báo giá P13' }) })) as QuoteRow;
    setCurrent(data);
    await load(token);
  }

  async function saveLines() {
    if (!current) return;
    const payload = {
      validity_days: days.trim() ? Number(days) : null,
      extra_discount_pct: extra.trim() ? String(Number(extra.replace(',', '.')) / 100) : '0',
      lines: lines.map((line) => ({
        line_type: line.line_type,
        service_code: line.service_code || null,
        level_code: line.level_code || null,
        item_code: line.item_code || null,
        qty: line.qty,
        discount_pct: line.discount_pct ? String(Number(line.discount_pct.replace(',', '.')) / 100) : null,
      })),
    };
    const data = (await call(token, `/api/crm/p13/proposals/${current.id}/lines`, { method: 'PUT', body: JSON.stringify(payload) })) as QuoteRow;
    setCurrent(data);
    await load(token);
  }

  async function act(path: string, body?: Record<string, unknown>) {
    if (!current) return;
    const data = (await call(token, `/api/crm/p13/proposals/${current.id}/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) })) as QuoteRow;
    setCurrent(data);
    await load(token);
  }

  const until = current?.issued_at ? current.valid_until : current?.valid_until_if_issued_today;
  const expired = Boolean(current?.blockers?.includes('quote_expired'));

  return (
    <div className="qt-list">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / P13</p>
          <h1>Báo giá P13</h1>
        </div>
        <button className="qt-btn qt-btn--primary" type="button" onClick={() => void createQuote().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'))}>
          Tạo báo giá
        </button>
      </header>
      {error ? <p className="qt-card qt-card--error">{error}</p> : null}
      <div className="qt-split">
        <table className="qt-table">
          <thead>
            <tr>
              <th>Số</th>
              <th>Trạng thái</th>
              <th>Tổng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => void openQuote(row.id)}>
                <td>
                  {row.quote_code} <span className="p13-badge">P13</span>
                  {row.blockers?.includes('quote_expired') ? <span className="p13-badge">Quá hạn hiệu lực</span> : null}
                </td>
                <td>
                  {row.status}
                  {row.p13_approval_status && row.p13_approval_status !== 'none' ? ` / ${row.p13_approval_status}` : ''}
                </td>
                <td>{money(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {current ? (
          <section className="qt-card">
            <h2>{current.quote_code}</h2>
            <p>
              Hiệu lực {current.issued_at ? `đến ${until ?? '—'}` : `dự kiến đến ${until ?? '—'}`}
              {expired ? ' · Quá hạn hiệu lực' : ''}
            </p>
            <label>
              Hiệu lực (ngày lịch)
              <input className="qt-inp" value={days} onChange={(event) => setDays(event.target.value)} />
            </label>
            <label>
              Chiết khấu thêm (%)
              <input className="qt-inp" value={extra} onChange={(event) => setExtra(event.target.value)} />
            </label>
            <p>Ngưỡng CK cần CEO duyệt: {current.discount_approval_threshold_pct ?? 'trống = mọi CK'}</p>
            {lines.map((line, index) => (
              <div key={index} className="qt-filters">
                <select className="qt-inp" value={line.line_type} onChange={(event) => setLines(lines.map((row, i) => (i === index ? { ...row, line_type: event.target.value as DraftLine['line_type'] } : row)))}>
                  <option value="package">Gói</option>
                  <option value="item">Hạng mục lẻ</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
                <input className="qt-inp" placeholder="Mã dịch vụ" value={line.service_code} onChange={(event) => setLines(lines.map((row, i) => (i === index ? { ...row, service_code: event.target.value } : row)))} />
                <input className="qt-inp" placeholder="Cấp độ" value={line.level_code} onChange={(event) => setLines(lines.map((row, i) => (i === index ? { ...row, level_code: event.target.value } : row)))} />
                <input className="qt-inp" placeholder="Mã hạng mục" value={line.item_code} onChange={(event) => setLines(lines.map((row, i) => (i === index ? { ...row, item_code: event.target.value } : row)))} />
                <input className="qt-inp" placeholder="SL" value={line.qty} onChange={(event) => setLines(lines.map((row, i) => (i === index ? { ...row, qty: event.target.value } : row)))} />
              </div>
            ))}
            <button className="qt-btn" type="button" onClick={() => setLines([...lines, emptyLine()])}>Thêm dòng</button>
            <button className="qt-btn qt-btn--primary" type="button" onClick={() => void saveLines().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'))}>Lưu nháp</button>
            <table className="qt-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Nội dung</th>
                  <th>ĐVT</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {current.lines?.map((line, index) => (
                  <tr key={index}>
                    <td>{line.line_type}</td>
                    <td>{line.description}</td>
                    <td>{line.unit}</td>
                    <td>{line.qty}</td>
                    <td>{money(line.unit_price)}</td>
                    <td>{money(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Cộng phí {money(current.totals?.fee_subtotal)} · VAT {money(current.totals?.fee_vat)} · Tổng {money(current.totals?.grand_total)}</p>
            {canViewP13QuoteMargin(user) ? <p>Biên LN {current.margin_pct_effective ?? '—'}</p> : null}
            {(current.warnings ?? []).map((code) => <p key={code}>{code}</p>)}
            {(current.blockers ?? []).map((code) => <p key={code}>{code}</p>)}
            <div className="qt-head__actions">
              <button className="qt-btn" type="button" onClick={() => void act('submit').catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'))}>Gửi duyệt</button>
              {canApproveP13Quote(user) ? (
                <>
                  <button className="qt-btn" type="button" onClick={() => void act('approve').catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'))}>Duyệt</button>
                  <input className="qt-inp" placeholder="Lý do trả về" value={note} onChange={(event) => setNote(event.target.value)} />
                  <button className="qt-btn" type="button" onClick={() => void act('return', { note }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'))}>Trả về</button>
                </>
              ) : null}
              {exportOn ? (
                <button
                  className="qt-btn"
                  type="button"
                  onClick={() => {
                    void fetch(`${API_BASE}/api/crm/p13/proposals/${current.id}/export`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mode: 'draft', display_mode: current.display_mode }),
                    }).then(async (res) => {
                      if (!res.ok) {
                        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; details?: { codes?: string[] } } };
                        setError([body.error?.code, ...(body.error?.details?.codes ?? [])].filter(Boolean).join(', '));
                        return;
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${current.quote_code}.pdf`;
                      link.click();
                      URL.revokeObjectURL(url);
                    });
                  }}
                >
                  Xuất nháp
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

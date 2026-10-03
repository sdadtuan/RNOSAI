'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import { getAccessToken, getStoredUser } from '@/lib/auth';
import { fetchP13ItemSearch, fetchP13Service, fetchP13Services, type P13ServiceRow } from '@/lib/p13/api';
import { canApproveP13Quote, canViewP13QuoteMargin, p13QuoteExportEnabled } from '@/lib/p13/flags';

const PRICE_INCOMPLETE = 'Chưa có bảng giá kích hoạt (pricing_params_incomplete)';
const LEVELS = [
  { id: 'basic', label: 'Cơ bản' },
  { id: 'standard', label: 'Tiêu chuẩn' },
  { id: 'advanced', label: 'Nâng cao' },
] as const;

type LevelCode = (typeof LEVELS)[number]['id'];

type ScopeMatrix = Array<{ feature: string; basic: string | null; standard: string | null; advanced: string | null }>;

type PricedLine = {
  line_type: string;
  description: string;
  unit: string;
  qty: string;
  unit_price: string | null;
  amount: string | null;
  service_code: string | null;
  level_code: string | null;
  item_code: string | null;
  scope?: string[];
};

type QuoteRow = {
  id: number;
  quote_code: string;
  status: string;
  p13_approval_status: string;
  validity_days: number | null;
  valid_until: string | null;
  issued_at: string | null;
  display_mode: string;
  needs_approval: boolean;
  approval_reasons: string[];
  warnings: string[];
  blockers: string[];
  missing: string[];
  extra_discount_pct?: string | null;
  discount_approval_threshold_pct?: string | null;
  valid_until_if_issued_today?: string | null;
  margin_pct_effective?: string | null;
  lines: PricedLine[];
  totals: { fee_subtotal: string | null; fee_vat: string | null; fee_total: string | null; grand_total: string | null } | null;
  total?: string | null;
};

type DraftLine = {
  line_type: 'package' | 'item' | 'custom';
  service_code: string;
  level_code: string;
  item_code: string;
  qty: string;
  unit_label: string;
};

type ItemHit = { code: string; name: string; unit: string; service_code: string };

const emptyLine = (): DraftLine => ({ line_type: 'package', service_code: '', level_code: 'standard', item_code: '', qty: '1', unit_label: 'gói' });

function money(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function priceLabel(row: { total?: string | null; totals?: { grand_total: string | null } | null; warnings?: string[]; missing?: string[] }): string {
  const total = row.totals?.grand_total ?? row.total;
  const incomplete = (row.warnings ?? []).includes('pricing_params_incomplete') || (row.missing ?? []).includes('pricing_version');
  if (!total && incomplete) return PRICE_INCOMPLETE;
  return money(total);
}

function viDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function percentToRatio(text: string): string {
  const cleaned = text.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return '0';
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return '0';
  const [whole, frac = ''] = cleaned.split('.');
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, '');
  const scale = frac.length + 2;
  const padded = digits.padStart(scale + 1, '0');
  const head = padded.slice(0, padded.length - scale);
  const tail = padded.slice(padded.length - scale).replace(/0+$/, '');
  return tail ? `${head || '0'}.${tail}` : head || '0';
}

function ratioToPercent(value: string | null | undefined): string {
  if (!value || value === '0') return '';
  if (!/^\d+(\.\d+)?$/.test(value)) return '';
  const [whole, frac = ''] = value.split('.');
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, '');
  if (frac.length >= 2) {
    const scale = frac.length - 2;
    const head = digits.slice(0, digits.length - scale) || '0';
    const tail = scale ? digits.slice(digits.length - scale) : '';
    return tail ? `${head}.${tail}` : head;
  }
  return `${digits}${'00'.slice(frac.length)}`.replace(/^0+(?=\d)/, '');
}

function validityProblem(text: string): string | null {
  if (!/^\d+$/.test(text.trim())) return 'quote_validity_out_of_range';
  const days = Number(text.trim());
  if (days < 1 || days > 30) return 'quote_validity_out_of_range';
  return null;
}

function scopeLines(matrix: ScopeMatrix, level: string): string[] {
  const key = level === 'basic' || level === 'advanced' ? level : 'standard';
  return matrix
    .map((row) => {
      const text = String(row[key] ?? '').trim();
      if (!text || text === '—') return '';
      return `${row.feature}: ${text}`;
    })
    .filter(Boolean);
}

function unitLabel(unit: string): string {
  if (unit === 'times') return 'lần';
  if (unit === 'month') return 'tháng';
  if (unit === 'shoot_day') return 'ngày quay';
  return unit || '—';
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

function draftFrom(line: PricedLine): DraftLine {
  const type = line.line_type === 'item' || line.line_type === 'custom' ? line.line_type : 'package';
  return {
    line_type: type,
    service_code: line.service_code ?? '',
    level_code: line.level_code ?? 'standard',
    item_code: line.item_code ?? '',
    qty: line.qty || '1',
    unit_label: line.unit || (type === 'package' ? 'gói' : ''),
  };
}

function lineReady(line: DraftLine): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(line.qty) || line.qty === '0') return false;
  if (line.line_type === 'package') return Boolean(line.service_code && line.level_code);
  if (line.line_type === 'item') return /^[A-Z][A-Z0-9]*-\d{2}-\d{2}$/.test(line.item_code);
  return Boolean(line.item_code || line.service_code);
}

export function P13QuotesScreen({ quoteId = null }: { quoteId?: number | null }) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [services, setServices] = useState<P13ServiceRow[]>([]);
  const [scopes, setScopes] = useState<Record<string, ScopeMatrix>>({});
  const [current, setCurrent] = useState<QuoteRow | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [extra, setExtra] = useState('');
  const [days, setDays] = useState('10');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [itemQuery, setItemQuery] = useState<Record<number, string>>({});
  const [itemHits, setItemHits] = useState<Record<number, ItemHit[]>>({});
  const dirty = useRef(false);
  const user = getStoredUser();
  const exportOn = p13QuoteExportEnabled();

  const load = useCallback(async (access: string) => {
    const data = (await call(access, '/api/crm/p13/proposals')) as QuoteRow[];
    setRows(data);
  }, []);

  const applyQuote = useCallback((data: QuoteRow) => {
    dirty.current = false;
    setCurrent(data);
    setDays(String(data.validity_days ?? 10));
    setLines(data.lines?.length ? data.lines.map(draftFrom) : [emptyLine()]);
    setExtra(ratioToPercent(data.extra_discount_pct));
  }, []);

  const openQuote = useCallback(async (access: string, id: number) => {
    const data = (await call(access, `/api/crm/p13/proposals/${id}`)) as QuoteRow;
    applyQuote(data);
  }, [applyQuote]);

  useEffect(() => {
    const access = getAccessToken() ?? '';
    setToken(access);
    if (!access) return;
    void load(access).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được'));
    void fetchP13Services(access).then(setServices).catch(() => setServices([]));
    if (quoteId) void openQuote(access, quoteId).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được'));
  }, [load, openQuote, quoteId]);

  useEffect(() => {
    if (!token) return;
    const pending = lines
      .filter((line) => line.line_type === 'package' && line.service_code && !scopes[line.service_code])
      .map((line) => line.service_code);
    const unique = [...new Set(pending)];
    if (!unique.length) return;
    void Promise.all(unique.map(async (code) => {
      const detail = await fetchP13Service(token, code);
      return [code, detail.scope_matrix ?? []] as const;
    })).then((pairs) => {
      setScopes((prev) => {
        const next = { ...prev };
        pairs.forEach(([code, matrix]) => {
          next[code] = matrix;
        });
        return next;
      });
    }).catch(() => undefined);
  }, [lines, scopes, token]);

  function mark(next: DraftLine[]) {
    dirty.current = true;
    setLines(next);
  }

  async function saveLines(access = token, quote = current, draft = lines, dayText = days, extraText = extra) {
    if (!quote) return;
    const problem = validityProblem(dayText);
    if (problem) {
      setError(problem);
      return;
    }
    if (!draft.every(lineReady)) return;
    const payload = {
      validity_days: Number(dayText.trim()),
      extra_discount_pct: percentToRatio(extraText),
      lines: draft.map((line) => ({
        line_type: line.line_type,
        service_code: line.line_type === 'package' ? line.service_code : null,
        level_code: line.line_type === 'package' ? line.level_code : null,
        item_code: line.line_type === 'item' ? line.item_code : null,
        qty: line.qty,
      })),
    };
    const data = (await call(access, `/api/crm/p13/proposals/${quote.id}/lines`, { method: 'PUT', body: JSON.stringify(payload) })) as QuoteRow;
    applyQuote(data);
    await load(access);
  }

  useEffect(() => {
    if (!dirty.current || !current || !token) return;
    const problem = validityProblem(days);
    if (problem || !lines.every(lineReady)) return;
    const handle = window.setTimeout(() => {
      void saveLines().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi'));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [lines, extra, days, current, token]);

  async function createQuote() {
    const data = (await call(token, '/api/crm/p13/proposals', { method: 'POST', body: JSON.stringify({ title: 'Báo giá P13' }) })) as QuoteRow;
    applyQuote(data);
    await load(token);
    router.push(`/crm/proposals/p13/${data.id}`);
  }

  async function act(path: string, body?: Record<string, unknown>) {
    if (!current) return;
    const data = (await call(token, `/api/crm/p13/proposals/${current.id}/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) })) as QuoteRow;
    applyQuote(data);
    await load(token);
  }

  async function searchItems(index: number, q: string) {
    setItemQuery((prev) => ({ ...prev, [index]: q }));
    if (q.trim().length < 2 || !token) {
      setItemHits((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    const hits = await fetchP13ItemSearch(token, q.trim());
    setItemHits((prev) => ({ ...prev, [index]: hits }));
  }

  const until = current?.issued_at ? current.valid_until : current?.valid_until_if_issued_today;
  const dayNumber = /^\d+$/.test(days.trim()) ? Number(days.trim()) : 0;
  const threshold = current?.discount_approval_threshold_pct;
  const showForm = Boolean(current);

  return (
    <div className="qt-list">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / P13</p>
          <h1>Tạo/Sửa báo giá P13</h1>
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
              <tr key={row.id} onClick={() => router.push(`/crm/proposals/p13/${row.id}`)}>
                <td>
                  {row.quote_code} <span className="p13-badge">P13</span>
                </td>
                <td>
                  {row.status}
                  {row.p13_approval_status && row.p13_approval_status !== 'none' ? ` / ${row.p13_approval_status}` : ''}
                </td>
                <td>{priceLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showForm && current ? (
          <section className="qt-card">
            <h2>{current.quote_code}</h2>
            <p>Hiệu lực mặc định 10 ngày lịch. {current.issued_at ? `Đến ${viDate(until)}` : `Dự kiến đến ${viDate(until)}`}.</p>
            <label>
              Hiệu lực (ngày lịch, 1–30)
              <input
                className="qt-inp"
                value={days}
                onChange={(event) => {
                  dirty.current = true;
                  setDays(event.target.value);
                }}
              />
            </label>
            <p className="qt-muted">
              {dayNumber >= 1 && dayNumber <= 10
                ? '1–10 ngày: AM sửa, không cần duyệt.'
                : dayNumber >= 11 && dayNumber <= 30
                  ? '11–30 ngày cần CEO duyệt (validity_above_default).'
                  : 'Ngoài 1–30 ngày: quote_validity_out_of_range.'}
            </p>
            {current.approval_reasons?.includes('validity_above_default') ? <p>Cần duyệt vì hiệu lực vượt mặc định (validity_above_default).</p> : null}
            <label>
              Chiết khấu thêm (%)
              <input
                className="qt-inp"
                value={extra}
                onChange={(event) => {
                  dirty.current = true;
                  setExtra(event.target.value);
                }}
              />
            </label>
            <p className="qt-muted">
              Ngưỡng CK thêm: {threshold == null || threshold === '' ? 'trống — mọi chiết khấu thêm cần duyệt' : threshold}
            </p>
            {current.approval_reasons?.includes('discount_above_threshold') ? (
              <p className="qt-card qt-card--error">Chiết khấu thêm vượt ngưỡng (discount_above_threshold)</p>
            ) : null}
            {lines.map((line, index) => {
              const saved = current.lines?.[index];
              const catalog = line.line_type === 'package' ? scopeLines(scopes[line.service_code] ?? [], line.level_code) : [];
              const scope = saved && saved.service_code === line.service_code && saved.level_code === line.level_code && saved.scope?.length
                ? saved.scope
                : catalog;
              return (
                <div key={`${index}-${line.line_type}`} className="qt-card">
                  <div className="qt-filters">
                    <select
                      className="qt-inp"
                      value={line.line_type}
                      onChange={(event) => mark(lines.map((row, i) => (i === index ? { ...row, line_type: event.target.value as DraftLine['line_type'], unit_label: event.target.value === 'package' ? 'gói' : row.unit_label } : row)))}
                    >
                      <option value="package">Gói</option>
                      <option value="item">Hạng mục</option>
                      {line.line_type === 'custom' ? <option value="custom">Tùy chỉnh</option> : null}
                    </select>
                    {line.line_type === 'package' ? (
                      <>
                        <select
                          className="qt-inp"
                          value={line.service_code}
                          onChange={(event) => mark(lines.map((row, i) => (i === index ? { ...row, service_code: event.target.value } : row)))}
                        >
                          <option value="">Chọn dịch vụ</option>
                          {services.map((service) => (
                            <option key={service.code} value={service.code}>{service.code} – {service.name}</option>
                          ))}
                        </select>
                        <select
                          className="qt-inp"
                          value={line.level_code}
                          onChange={(event) => mark(lines.map((row, i) => (i === index ? { ...row, level_code: event.target.value as LevelCode } : row)))}
                        >
                          {LEVELS.map((level) => (
                            <option key={level.id} value={level.id}>{level.label}</option>
                          ))}
                        </select>
                        <span className="qt-muted">ĐVT: gói</span>
                      </>
                    ) : (
                      <>
                        <input
                          className="qt-inp"
                          placeholder="Mã hạng mục, vd WEB-04-08"
                          value={itemQuery[index] ?? line.item_code}
                          onChange={(event) => {
                            const value = event.target.value;
                            mark(lines.map((row, i) => (i === index ? { ...row, item_code: value.trim().toUpperCase() } : row)));
                            void searchItems(index, value);
                          }}
                        />
                        <span className="qt-muted">ĐVT: {line.unit_label || '—'}</span>
                      </>
                    )}
                    <input
                      className="qt-inp"
                      placeholder="SL"
                      value={line.qty}
                      onChange={(event) => mark(lines.map((row, i) => (i === index ? { ...row, qty: event.target.value } : row)))}
                    />
                  </div>
                  {line.line_type === 'item' && itemHits[index]?.length ? (
                    <ul>
                      {itemHits[index].map((hit) => (
                        <li key={hit.code}>
                          <button
                            type="button"
                            className="qt-btn"
                            onClick={() => {
                              mark(lines.map((row, i) => (i === index ? { ...row, item_code: hit.code, unit_label: unitLabel(hit.unit) } : row)));
                              setItemHits((prev) => ({ ...prev, [index]: [] }));
                              setItemQuery((prev) => ({ ...prev, [index]: hit.code }));
                            }}
                          >
                            {hit.code} – {hit.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {line.line_type === 'package' && scope.length ? (
                    <div>
                      <p>Phạm vi bao gồm</p>
                      <ul>
                        {scope.map((text) => <li key={text}>{text}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button className="qt-btn" type="button" onClick={() => mark([...lines, emptyLine()])}>Thêm dòng</button>
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
            {priceLabel(current) === PRICE_INCOMPLETE ? (
              <p>{PRICE_INCOMPLETE}</p>
            ) : (
              <p>Cộng phí {money(current.totals?.fee_subtotal)} · VAT {money(current.totals?.fee_vat)} · Tổng {money(current.totals?.grand_total ?? current.total)}</p>
            )}
            {canViewP13QuoteMargin(user) ? <p>Biên LN {current.margin_pct_effective ?? '—'}</p> : null}
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

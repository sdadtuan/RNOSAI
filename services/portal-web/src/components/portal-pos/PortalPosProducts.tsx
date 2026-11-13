'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalMediaUrl, uploadPortalProductImage, fetchPortalDesk, type PortalDesk } from '@/lib/api';
import {
  posGet, posPost, posPatch, posUploadCsv, vnd,
  type PosProduct, type PosVariant,
} from '@/lib/portal-pos-api';

type Props = { token: string; canManage: boolean };

const emptyDraft = () => ({
  name: '', sku: '', barcode: '', category_name: '', category_id: '',
  detail: '', image_url: '', price_vnd: '', compare_at_vnd: '', cost_vnd: '',
  weight_gram: '', low_stock_threshold: '5', page_id: '', active: true, is_combo: false,
  variants: [{ color: '', size: '', sku: '', barcode: '', price_vnd: '', cost_vnd: '', compare_at_vnd: '', weight_gram: '', image_url: '', stock: '0', active: true }] as Array<Record<string, string | boolean>>,
});

export function PortalPosProducts({ token, canManage }: Props) {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>('');
  const [draft, setDraft] = useState(emptyDraft());
  const [newCat, setNewCat] = useState('');
  const [stockFor, setStockFor] = useState<PosVariant | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockKind, setStockKind] = useState<'import' | 'export' | 'adjust'>('import');
  const [stockNote, setStockNote] = useState('');

  const load = useCallback(async () => {
    const [prod, cats, d] = await Promise.all([
      posGet<{ products: PosProduct[] }>(token, `/api/portal/pos/products?q=${encodeURIComponent(q)}${categoryId ? `&category_id=${categoryId}` : ''}${lowOnly ? '&low_stock=1' : ''}`),
      posGet<{ categories: Array<{ id: string; name: string }> }>(token, '/api/portal/pos/categories'),
      fetchPortalDesk(token, { include_inactive: '1' }).catch(() => null),
    ]);
    setProducts(prod.products);
    setCategories(cats.categories);
    if (d) setDesk(d);
  }, [token, q, categoryId, lowOnly]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được sản phẩm'));
  }, [load]);

  function startCreate() {
    setEditing('');
    setDraft(emptyDraft());
    setOpen(true);
  }
  function startEdit(p: PosProduct) {
    setEditing(p.id);
    setDraft({
      name: p.name, sku: p.sku, barcode: p.barcode, category_name: p.category_name,
      category_id: p.category_id || '', detail: p.detail, image_url: p.image_url,
      price_vnd: p.price_vnd ? String(p.price_vnd) : '',
      compare_at_vnd: p.compare_at_vnd ? String(p.compare_at_vnd) : '',
      cost_vnd: p.cost_vnd ? String(p.cost_vnd) : '',
      weight_gram: p.weight_gram ? String(p.weight_gram) : '',
      low_stock_threshold: String(p.low_stock_threshold ?? 5),
      page_id: p.page_id, active: p.active, is_combo: p.is_combo,
      variants: (p.variants.length ? p.variants : [{ color: '', size: '' } as PosVariant]).map((v) => ({
        id: v.id, color: v.color, size: v.size, sku: v.sku, barcode: v.barcode,
        price_vnd: v.price_vnd ? String(v.price_vnd) : '', cost_vnd: v.cost_vnd ? String(v.cost_vnd) : '',
        compare_at_vnd: v.compare_at_vnd ? String(v.compare_at_vnd) : '',
        weight_gram: v.weight_gram ? String(v.weight_gram) : '', image_url: v.image_url,
        stock: String(v.on_hand), active: v.active,
      })),
    });
    setOpen(true);
  }

  function moneyOf(v: string) { return Number(String(v).replace(/[^\d]/g, '')) || null; }

  async function save() {
    setBusy(true); setError('');
    try {
      const payload = {
        name: draft.name.trim(), sku: draft.sku, barcode: draft.barcode,
        category_id: draft.category_id || null, category_name: draft.category_name,
        detail: draft.detail, image_url: draft.image_url, page_id: draft.page_id,
        price_vnd: moneyOf(draft.price_vnd), compare_at_vnd: moneyOf(draft.compare_at_vnd),
        cost_vnd: moneyOf(draft.cost_vnd), weight_gram: moneyOf(draft.weight_gram),
        low_stock_threshold: Number(draft.low_stock_threshold) || 5,
        active: draft.active, is_combo: draft.is_combo,
        variants: draft.variants.map((v) => ({
          id: (v.id as string) || undefined,
          color: String(v.color || ''), size: String(v.size || ''), sku: String(v.sku || ''),
          barcode: String(v.barcode || ''), image_url: String(v.image_url || ''),
          price_vnd: moneyOf(String(v.price_vnd || draft.price_vnd)),
          compare_at_vnd: moneyOf(String(v.compare_at_vnd || '')),
          cost_vnd: moneyOf(String(v.cost_vnd || '')),
          weight_gram: moneyOf(String(v.weight_gram || draft.weight_gram)),
          stock: editing ? undefined : Number(v.stock) || 0,
          active: v.active !== false,
        })),
      };
      if (editing) await posPatch(token, `/api/portal/pos/products/${editing}`, payload);
      else await posPost(token, '/api/portal/pos/products', payload);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally { setBusy(false); }
  }

  async function onUpload(file: File, target: 'product' | number) {
    const mime = (file.type || '').toLowerCase();
    const named = /\.(jpe?g|png|webp)$/i.test(file.name);
    if ((!mime.startsWith('image/') && !named) || file.size > 2_000_000) {
      setError('Ảnh JPG, PNG hoặc WebP, tối đa 2 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = await uploadPortalProductImage(token, file);
      if (target === 'product') setDraft((d) => ({ ...d, image_url: url }));
      else setDraft((d) => ({ ...d, variants: d.variants.map((v, i) => (i === target ? { ...v, image_url: url } : v)) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    await posPost(token, '/api/portal/pos/categories', { name: newCat.trim() });
    setNewCat('');
    await load();
  }

  async function applyStock() {
    if (!stockFor) return;
    setBusy(true); setError('');
    try {
      await posPost(token, '/api/portal/pos/stock/move', {
        variant_id: stockFor.id, kind: stockKind, qty: Number(stockQty) || 0, note: stockNote,
      });
      setStockFor(null); setStockQty(''); setStockNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không điều chỉnh được tồn');
    } finally { setBusy(false); }
  }

  async function onCsv(file: File) {
    setBusy(true); setError('');
    try {
      const res = await posUploadCsv(token, '/api/portal/pos/products/import', file) as { imported?: number; errors?: Array<{ error: string }> };
      if (res.errors?.length) setError(`Đã nhập ${res.imported ?? 0} sản phẩm. ${res.errors.length} dòng lỗi.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhập được CSV');
    } finally { setBusy(false); }
  }

  const pages = (desk?.pages ?? []).filter((p) => p.channel !== 'ad_account');

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <h1>Sản phẩm</h1>
          <p>Danh mục, biến thể (màu / size), SKU, tồn kho một kho mặc định cho mỗi khách hàng.</p>
        </div>
        {canManage ? (
          <div className="pos__actions">
            <label className="pos-btn">
              Nhập CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
            </label>
            <button type="button" className="pos-btn pos-btn--teal" onClick={startCreate}>Thêm sản phẩm</button>
          </div>
        ) : null}
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      <div className="pos-filters">
        <input className="pos-input" placeholder="Tìm tên, SKU, mã vạch" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="pos-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="pos-hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Sắp hết hàng
        </label>
        {canManage ? (
          <span style={{ display: 'flex', gap: 6 }}>
            <input className="pos-input" placeholder="Danh mục mới" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button type="button" className="pos-btn pos-btn--sm" onClick={() => void addCategory()}>Thêm</button>
          </span>
        ) : null}
      </div>
      {products.length === 0 ? (
        <div className="pos-empty pos-card">Chưa có sản phẩm. {canManage ? 'Bấm Thêm sản phẩm hoặc nhập CSV (cột: Tên, SKU, Giá, Tồn kho, Màu, Size).' : ''}</div>
      ) : (
        <div className="pos-table-wrap portal-table-scroll">
        <table className="pos-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>SKU</th>
              <th>Danh mục</th>
              <th>Giá</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              {canManage ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} onClick={() => canManage && startEdit(p)}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {p.image_url ? (
                      <img
                        className="pos-thumb"
                        src={portalMediaUrl(p.image_url)}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                          const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'grid';
                        }}
                      />
                    ) : null}
                    <div className="pos-thumb is-placeholder" style={p.image_url ? { display: 'none' } : undefined} aria-hidden />
                    <div>
                      <strong>{p.name}</strong>
                      <div className="pos-hint">{p.variants.length} biến thể{p.barcode ? ` · ${p.barcode}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td>{p.sku || '—'}</td>
                <td>{p.category_name || '—'}</td>
                <td>{p.price_vnd ? vnd(p.price_vnd) : (p.variants[0]?.price_vnd ? vnd(p.variants[0].price_vnd) : '—')}
                  {p.compare_at_vnd ? <div className="pos-hint" style={{ textDecoration: 'line-through' }}>{vnd(p.compare_at_vnd)}</div> : null}
                </td>
                <td>
                  {p.available} <span className="pos-hint">(có {p.on_hand}, giữ {p.reserved})</span>
                  {p.on_hand <= 0 ? null : p.low_stock ? (
                    <div><span className="pos-badge pos-badge--low">Sắp hết</span></div>
                  ) : null}
                </td>
                <td>{p.on_hand <= 0 ? (
                  <span className="pos-badge pos-badge--oos">Hết hàng</span>
                ) : (
                  <span className={`pos-badge ${p.active ? 'pos-badge--ok' : 'pos-badge--off'}`}>{p.active ? 'Đang bán' : 'Ẩn'}</span>
                )}</td>
                {canManage ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="pos-btn pos-btn--sm" onClick={() => startEdit(p)}>Sửa</button>
                    {p.variants[0] ? (
                      <button type="button" className="pos-btn pos-btn--sm pos-btn--ghost" onClick={() => { setStockFor(p.variants[0]); setStockKind('import'); }}>Kho</button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {open ? (
        <div className="pos-drawer" onClick={() => setOpen(false)} role="presentation">
          <div className="pos-drawer__panel" onClick={(e) => e.stopPropagation()} role="dialog">
            <header className="pos__head">
              <h2>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
              <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setOpen(false)}>Đóng</button>
            </header>
            <div className="pos-grid pos-grid--form">
              <label className="pos-field">Tên sản phẩm<input className="pos-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
              <label className="pos-field">SKU<input className="pos-input" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></label>
              <label className="pos-field">Mã vạch<input className="pos-input" value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} /></label>
              <label className="pos-field">Danh mục
                <select className="pos-select" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="pos-field">Giá bán<input className="pos-input" value={draft.price_vnd} onChange={(e) => setDraft({ ...draft, price_vnd: e.target.value })} inputMode="numeric" /></label>
              <label className="pos-field">Giá so sánh<input className="pos-input" value={draft.compare_at_vnd} onChange={(e) => setDraft({ ...draft, compare_at_vnd: e.target.value })} inputMode="numeric" /></label>
              <label className="pos-field">Giá vốn<input className="pos-input" value={draft.cost_vnd} onChange={(e) => setDraft({ ...draft, cost_vnd: e.target.value })} inputMode="numeric" /></label>
              <label className="pos-field">Khối lượng (gram)<input className="pos-input" value={draft.weight_gram} onChange={(e) => setDraft({ ...draft, weight_gram: e.target.value })} inputMode="numeric" /></label>
              <label className="pos-field">Ngưỡng sắp hết<input className="pos-input" value={draft.low_stock_threshold} onChange={(e) => setDraft({ ...draft, low_stock_threshold: e.target.value })} /></label>
              {pages.length ? (
                <label className="pos-field">Gắn Page
                  <select className="pos-select" value={draft.page_id} onChange={(e) => setDraft({ ...draft, page_id: e.target.value })}>
                    <option value="">Không gắn</option>
                    {pages.map((p) => <option key={p.page_id} value={p.page_id}>{p.page_name || p.page_id}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <label className="pos-field" style={{ marginTop: 12 }}>Mô tả<textarea className="pos-input" rows={2} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} /></label>
            <div className="pos-drawer__media">
              {draft.image_url ? <img className="pos-thumb" src={portalMediaUrl(draft.image_url)} alt="" /> : null}
              <label className="pos-btn pos-btn--sm">Tải ảnh / dán URL
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f, 'product'); }} />
              </label>
              <input className="pos-input" style={{ maxWidth: 280 }} placeholder="https://…" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} />
              <label className="pos-hint"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Đang bán</label>
            </div>
            <h3 style={{ margin: '1rem 0 0.5rem' }}>Biến thể (màu, size)</h3>
            {draft.variants.map((v, i) => (
              <div key={i} className="pos-grid pos-grid--form pos-card" style={{ marginBottom: 8, padding: 10 }}>
                <label className="pos-field">Màu<input className="pos-input" value={String(v.color)} onChange={(e) => setDraft({ ...draft, variants: draft.variants.map((x, j) => j === i ? { ...x, color: e.target.value } : x) })} /></label>
                <label className="pos-field">Size<input className="pos-input" value={String(v.size)} onChange={(e) => setDraft({ ...draft, variants: draft.variants.map((x, j) => j === i ? { ...x, size: e.target.value } : x) })} /></label>
                <label className="pos-field">SKU<input className="pos-input" value={String(v.sku)} onChange={(e) => setDraft({ ...draft, variants: draft.variants.map((x, j) => j === i ? { ...x, sku: e.target.value } : x) })} /></label>
                <label className="pos-field">Giá<input className="pos-input" value={String(v.price_vnd)} onChange={(e) => setDraft({ ...draft, variants: draft.variants.map((x, j) => j === i ? { ...x, price_vnd: e.target.value } : x) })} /></label>
                {!editing ? <label className="pos-field">Tồn ban đầu<input className="pos-input" value={String(v.stock)} onChange={(e) => setDraft({ ...draft, variants: draft.variants.map((x, j) => j === i ? { ...x, stock: e.target.value } : x) })} /></label> : null}
                {editing && v.id ? (
                  <button type="button" className="pos-btn pos-btn--sm" onClick={() => setStockFor({ id: String(v.id), sku: String(v.sku), color: String(v.color), size: String(v.size), on_hand: Number(v.stock) || 0, reserved: 0, available: 0, low_stock: false, barcode: '', price_vnd: null, compare_at_vnd: null, cost_vnd: null, weight_gram: null, image_url: '', active: true })}>Nhập / xuất kho</button>
                ) : null}
                <button type="button" className="pos-btn pos-btn--sm pos-btn--danger" onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}>Xóa</button>
              </div>
            ))}
            <button type="button" className="pos-btn pos-btn--sm" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { color: '', size: '', sku: '', barcode: '', price_vnd: '', stock: '0', active: true, image_url: '', cost_vnd: '', compare_at_vnd: '', weight_gram: '' }] })}>Thêm biến thể</button>
            <div className="pos__actions" style={{ marginTop: 16 }}>
              <button type="button" className="pos-btn pos-btn--teal" disabled={busy || !draft.name.trim()} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
              <button type="button" className="pos-btn" onClick={() => setOpen(false)}>Hủy</button>
            </div>
          </div>
        </div>
      ) : null}

      {stockFor ? (
        <div className="pos-drawer" onClick={() => setStockFor(null)} role="presentation">
          <div className="pos-drawer__panel" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2>Kho — {[stockFor.color, stockFor.size].filter(Boolean).join(' / ') || stockFor.sku || 'Mặc định'}</h2>
            <p className="pos-hint">Tồn hiện tại: {stockFor.on_hand} (giữ chỗ xem trên danh sách sau khi lưu)</p>
            <label className="pos-field">Loại
              <select className="pos-select" value={stockKind} onChange={(e) => setStockKind(e.target.value as 'import' | 'export' | 'adjust')}>
                <option value="import">Nhập kho</option>
                <option value="export">Xuất kho</option>
                <option value="adjust">Đặt tồn tuyệt đối</option>
              </select>
            </label>
            <label className="pos-field" style={{ marginTop: 8 }}>Số lượng<input className="pos-input" value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" /></label>
            <label className="pos-field" style={{ marginTop: 8 }}>Ghi chú<input className="pos-input" value={stockNote} onChange={(e) => setStockNote(e.target.value)} /></label>
            <div className="pos__actions" style={{ marginTop: 16 }}>
              <button type="button" className="pos-btn pos-btn--teal" disabled={busy} onClick={() => void applyStock()}>Áp dụng</button>
              <button type="button" className="pos-btn" onClick={() => setStockFor(null)}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

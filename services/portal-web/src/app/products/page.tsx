'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  deletePortalProduct,
  fetchPortalDesk,
  patchPortalProduct,
  portalMediaUrl,
  postPortalPage,
  uploadPortalProductImage,
  type PortalDesk,
  type PortalProductRecord,
} from '@/lib/api';

const SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL', 'Freesize'];

type DraftColor = { key: string; name: string; image: string };
type DraftOption = { key: string; name: string; values: string[]; draft: string };

function money(value: number | null | undefined): string {
  if (!value) return '';
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

export default function ProductsPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/crm' }, { label: 'Sản Phẩm' }]}>
      {({ token, user }) => <Catalog token={token} canManage={user.role !== 'staff'} />}
    </PortalPageShell>
  );
}

function Catalog({ token, canManage }: { token: string; canManage: boolean }) {
  const searchParams = useSearchParams();
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [pageId, setPageId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [detail, setDetail] = useState('');
  const [colors, setColors] = useState<DraftColor[]>([{ key: 'c1', name: '', image: '' }]);
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L']);
  const [customSize, setCustomSize] = useState('');
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchPortalDesk(token, canManage ? { include_inactive: '1' } : {});
    setDesk(data);
    const urlPage = searchParams.get('page_id')?.trim() || '';
    const pick =
      urlPage && data.pages.some((page) => page.page_id === urlPage)
        ? urlPage
        : data.pages.find((page) => page.channel !== 'ad_account')?.page_id || '';
    setPageId((current) => current || pick);
  }, [token, canManage, searchParams]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được sản phẩm'));
  }, [load]);

  useEffect(() => {
    const urlPage = searchParams.get('page_id')?.trim();
    if (urlPage && desk?.pages.some((page) => page.page_id === urlPage)) setPageId(urlPage);
  }, [searchParams, desk]);

  const pages = (desk?.pages ?? []).filter((page) => page.channel !== 'ad_account');
  const products = (desk?.products ?? []).filter((item) => item.page_id === pageId);
  const page = pages.find((item) => item.page_id === pageId);

  function reset() {
    setEditingId('');
    setName('');
    setPrice('');
    setDetail('');
    setColors([{ key: String(Date.now()), name: '', image: '' }]);
    setSizes(['S', 'M', 'L']);
    setOptions([]);
  }

  function beginEdit(item: PortalProductRecord) {
    const spec = item.spec;
    setEditingId(item.id);
    setName(item.name);
    setPrice(spec?.price_vnd ? String(spec.price_vnd) : '');
    setDetail(item.detail);
    setColors(
      (spec?.colors?.length ? spec.colors : [{ name: '', image: item.image_url }]).map((color, index) => ({
        key: `edit-${item.id}-${index}`,
        name: color.name,
        image: color.image,
      })),
    );
    setSizes(spec?.sizes?.length ? spec.sizes : ['S', 'M', 'L']);
    setOptions(
      (spec?.options ?? []).map((opt, index) => ({
        key: `opt-${item.id}-${index}`,
        name: opt.name,
        values: opt.values,
        draft: '',
      })),
    );
  }

  async function submitProduct(page_id: string) {
    const ready = colors.filter((item) => item.name.trim() && item.image);
    if (!ready.length) {
      setError('Thêm ít nhất một màu và tải ảnh cho màu đó.');
      return;
    }
    const payload = {
      name: name.trim(),
      detail: detail.trim(),
      price_vnd: Number(price.replace(/\D/g, '')) || null,
      colors: ready.map((item) => ({ name: item.name.trim(), image: item.image })),
      sizes,
      options: options.filter((item) => item.name.trim() && item.values.length).map((item) => ({ name: item.name.trim(), values: item.values })),
    };
    if (editingId) {
      await patchPortalProduct(token, page_id, editingId, payload);
    } else {
      await postPortalPage(token, page_id, 'products', payload);
    }
    reset();
    await load();
  }

  async function onUpload(key: string, file: File) {
    if (!file.type.startsWith('image/') || file.size > 2_000_000) {
      setError('Ảnh phải là JPG, PNG hoặc WebP, tối đa 2 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = await uploadPortalProductImage(token, file);
      setColors((rows) => rows.map((row) => (row.key === key ? { ...row, image: url } : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được ảnh');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="catalog">
      <header className="catalog__head">
        <div>
          <h1>Sản Phẩm</h1>
          <p>Mỗi màu có ảnh riêng. Size và tùy chọn là các lựa chọn khách có thể chọn trong hộp thư.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="catalog__pages" role="tablist" aria-label="Page">
        {pages.map((item) => (
          <button key={item.page_id} type="button" role="tab" aria-selected={item.page_id === pageId} className={item.page_id === pageId ? 'is-active' : ''} onClick={() => setPageId(item.page_id)}>
            <strong>{item.page_name || 'Page'}</strong>
            <span>{item.page_id}</span>
          </button>
        ))}
      </div>
      {!pages.length ? <p className="catalog__empty">Chưa gắn Page từ Kênh ads.</p> : null}
      {page ? (
        <div className="catalog__layout">
          {canManage ? (
            <form
              className="catalog__editor"
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                setError('');
                void submitProduct(page.page_id)
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không lưu được sản phẩm'))
                  .finally(() => setBusy(false));
              }}
            >
              <h2>{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
              {editingId ? (
                <button type="button" className="catalog__text" onClick={reset}>
                  Hủy sửa
                </button>
              ) : null}
              <p className="catalog__page-note">Gắn vào {page.page_name || 'Page'}</p>
              <label>Tên sản phẩm<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Áo thun cổ tròn" /></label>
              <label>Giá (đ)<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder="199000" /></label>
              <label>Mô tả<textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} placeholder="Chất liệu, form, lưu ý giao hàng" /></label>

              <section>
                <div className="catalog__section-head">
                  <h3>Màu và ảnh</h3>
                  <button type="button" className="catalog__text" onClick={() => setColors((rows) => [...rows, { key: String(Date.now()), name: '', image: '' }])}>Thêm màu</button>
                </div>
                <div className="catalog__colors">
                  {colors.map((color) => (
                    <article key={color.key}>
                      <label className="catalog__drop">
                        {color.image ? <img src={portalMediaUrl(color.image)} alt="" /> : <span>Tải ảnh màu này</span>}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void onUpload(color.key, file);
                        }} />
                      </label>
                      <input value={color.name} onChange={(event) => setColors((rows) => rows.map((row) => row.key === color.key ? { ...row, name: event.target.value } : row))} placeholder="Tên màu, ví dụ Đen" aria-label="Tên màu" />
                      {colors.length > 1 ? <button type="button" className="catalog__text" onClick={() => setColors((rows) => rows.filter((row) => row.key !== color.key))}>Bỏ màu</button> : null}
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>Size</h3>
                <div className="catalog__chips">
                  {SIZE_PRESETS.map((size) => (
                    <button key={size} type="button" className={sizes.includes(size) ? 'is-on' : ''} onClick={() => setSizes((current) => current.includes(size) ? current.filter((item) => item !== size) : [...current, size])}>{size}</button>
                  ))}
                </div>
                <div className="catalog__inline">
                  <input value={customSize} onChange={(event) => setCustomSize(event.target.value)} placeholder="Size khác, ví dụ 29" />
                  <button type="button" onClick={() => {
                    const value = customSize.trim();
                    if (!value) return;
                    setSizes((current) => current.includes(value) ? current : [...current, value]);
                    setCustomSize('');
                  }}>Thêm</button>
                </div>
                {sizes.some((size) => !SIZE_PRESETS.includes(size)) ? (
                  <div className="catalog__chips">
                    {sizes.filter((size) => !SIZE_PRESETS.includes(size)).map((size) => (
                      <button key={size} type="button" className="is-on" onClick={() => setSizes((current) => current.filter((item) => item !== size))}>{size} ×</button>
                    ))}
                  </div>
                ) : null}
              </section>

              <section>
                <div className="catalog__section-head">
                  <h3>Tùy chọn</h3>
                  <button type="button" className="catalog__text" onClick={() => setOptions((rows) => [...rows, { key: String(Date.now()), name: '', values: [], draft: '' }])}>Thêm nhóm</button>
                </div>
                {options.length === 0 ? <p className="catalog__hint">Ví dụ chất liệu, kiểu cổ, hoặc quà tặng kèm. Không bắt buộc.</p> : null}
                {options.map((option) => (
                  <div key={option.key} className="catalog__option">
                    <input value={option.name} onChange={(event) => setOptions((rows) => rows.map((row) => row.key === option.key ? { ...row, name: event.target.value } : row))} placeholder="Tên tùy chọn, ví dụ Chất liệu" />
                    <div className="catalog__inline">
                      <input value={option.draft} onChange={(event) => setOptions((rows) => rows.map((row) => row.key === option.key ? { ...row, draft: event.target.value } : row))} placeholder="Giá trị, rồi bấm Thêm" />
                      <button type="button" onClick={() => setOptions((rows) => rows.map((row) => {
                        if (row.key !== option.key) return row;
                        const value = row.draft.trim();
                        if (!value || row.values.includes(value)) return { ...row, draft: '' };
                        return { ...row, draft: '', values: [...row.values, value] };
                      }))}>Thêm</button>
                    </div>
                    <div className="catalog__chips">
                      {option.values.map((value) => (
                        <button key={value} type="button" className="is-on" onClick={() => setOptions((rows) => rows.map((row) => row.key === option.key ? { ...row, values: row.values.filter((item) => item !== value) } : row))}>{value} ×</button>
                      ))}
                    </div>
                    <button type="button" className="catalog__text" onClick={() => setOptions((rows) => rows.filter((row) => row.key !== option.key))}>Bỏ nhóm này</button>
                  </div>
                ))}
              </section>
              <button className="catalog__save" type="submit" disabled={busy}>{busy ? 'Đang lưu' : editingId ? 'Cập nhật sản phẩm' : 'Lưu sản phẩm'}</button>
            </form>
          ) : null}
          <div className="catalog__grid">
            {products.length === 0 ? <p className="catalog__empty">Page này chưa có sản phẩm.</p> : products.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                canManage={canManage}
                busy={busy}
                editing={editingId === item.id}
                onEdit={() => beginEdit(item)}
                onToggleActive={() => {
                  if (!window.confirm(item.active === false ? 'Bật lại Đang bán?' : 'Chuyển sang Ngừng bán?')) return;
                  setBusy(true);
                  void patchPortalProduct(token, page.page_id, item.id, { active: item.active === false })
                    .then(load)
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không cập nhật được'))
                    .finally(() => setBusy(false));
                }}
                onDelete={() => {
                  if (!window.confirm('Xóa sản phẩm này?')) return;
                  setBusy(true);
                  void deletePortalProduct(token, page.page_id, item.id).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không xóa được')).finally(() => setBusy(false));
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({
  item,
  canManage,
  busy,
  editing,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  item: PortalProductRecord;
  canManage: boolean;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const spec = item.spec;
  const cover = spec?.colors[0]?.image || item.image_url;
  const inactive = item.active === false;
  return (
    <article className={editing ? 'catalog__card is-editing' : inactive ? 'catalog__card is-inactive' : 'catalog__card'}>
      <div className="catalog__cover">{cover ? <img src={portalMediaUrl(cover)} alt="" /> : <span>Chưa có ảnh</span>}</div>
      <div className="catalog__card-body">
        <h3>{item.name}</h3>
        {inactive ? <p className="catalog__meta">Ngừng bán</p> : <p className="catalog__meta">Đang bán</p>}
        {spec?.price_vnd ? <p className="catalog__price">{money(spec.price_vnd)}</p> : null}
        {item.detail ? <p>{item.detail}</p> : null}
        {spec?.colors?.length ? (
          <div className="catalog__swatches">
            {spec.colors.map((color) => (
              <figure key={color.name}>
                <img src={portalMediaUrl(color.image)} alt="" />
                <figcaption>{color.name}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        {spec?.sizes?.length ? <p className="catalog__meta">Size {spec.sizes.join(' · ')}</p> : null}
        {spec?.options?.map((option) => <p key={option.name} className="catalog__meta">{option.name}: {option.values.join(' · ')}</p>)}
        {canManage ? (
          <div className="catalog__card-actions">
            <button type="button" className="catalog__text" disabled={busy} onClick={onEdit}>
              {editing ? 'Đang sửa…' : 'Sửa'}
            </button>
            <button type="button" className="catalog__text" disabled={busy} onClick={onToggleActive}>
              {inactive ? 'Bật Đang bán' : 'Ngừng bán'}
            </button>
            <button type="button" className="catalog__text" disabled={busy} onClick={onDelete}>
              Xóa sản phẩm
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

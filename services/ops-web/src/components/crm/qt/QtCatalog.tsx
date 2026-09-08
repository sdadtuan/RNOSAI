'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { getQtQuoteCatalog, type QtCatalogItem } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export type { QtCatalogItem };

export const QT_CATALOG_NAV_GROUPS = [
  'strategy',
  'branding',
  'content',
  'production',
  'performance',
  'web',
  'seo',
  'crm',
  'retention',
  'pr',
  'event',
  'sales',
  'data',
] as const;

export type QtCatalogNavGroup = (typeof QT_CATALOG_NAV_GROUPS)[number];

export const VID_TPL_01 = 'VID-TPL-01';

export const QT_CATALOG_GROUP_META: Record<
  QtCatalogNavGroup | 'package',
  { title: string; hint: string }
> = {
  strategy: { title: '1. Strategy & Research', hint: 'Audit · insight · kế hoạch' },
  branding: { title: '2. Branding & Creative', hint: 'Identity · key visual' },
  content: { title: '3. Content & Social', hint: 'Retainer 3 SKU' },
  production: { title: '4. Video & Image', hint: 'Reels · Brand Film' },
  performance: { title: '5. Performance & Media', hint: 'Meta / Google / TikTok' },
  web: { title: '6. Web, LP & CRO', hint: 'Landing · A/B' },
  seo: { title: '7. SEO / AEO / Organic', hint: 'Technical + content' },
  crm: { title: '8. CRM, Automation & AI', hint: 'Không add quote khách' },
  retention: { title: '9. Email & Retention', hint: 'Journey · flow' },
  pr: { title: '10. PR, KOL & Reputation', hint: 'Booking KOL' },
  event: { title: '11. Event & Activation', hint: 'Offline / launch' },
  sales: { title: '12. Sales Enablement B2B', hint: 'Deck · playbook' },
  data: { title: '13. Data & Analytics', hint: 'Dashboard · pixel' },
  package: { title: 'Ngành BĐS / Spa / Edu / Growth', hint: 'Package ngành' },
};

export const VID_TPL_01_SCENES = [
  { n: 1, scene: 'Hook căn hộ / lifestyle', duration: '0–6s' },
  { n: 2, scene: 'Vấn đề khách', duration: '6–14s' },
  { n: 3, scene: 'Giải pháp PTT', duration: '14–24s' },
  { n: 4, scene: 'Social proof', duration: '24–32s' },
  { n: 5, scene: 'Offer', duration: '32–40s' },
  { n: 6, scene: 'CTA đặt lịch', duration: '40–45s' },
] as const;

export function catalogGroupKeys(items: QtCatalogItem[]): Array<QtCatalogNavGroup | 'package'> {
  const keys: Array<QtCatalogNavGroup | 'package'> = [...QT_CATALOG_NAV_GROUPS];
  if (items.some((item) => item.group === 'package')) keys.push('package');
  return keys;
}

export function canAddToClientQuote(item: QtCatalogItem): boolean {
  return item.can_add_to_client_quote === true && String(item.status ?? '').toLowerCase() !== 'draft';
}

export function catalogDisplayName(item: QtCatalogItem): string {
  return String(item.name_vi || item.name || item.dv_code || '').trim() || dash(null);
}

export function QtCatalogGroups({
  items,
  selected,
  onSelect,
}: {
  items: QtCatalogItem[];
  selected?: string | null;
  onSelect?: (group: string) => void;
}) {
  const keys = catalogGroupKeys(items);
  return (
    <div className="qt-cat-grid">
      {keys.map((key) => {
        const meta = QT_CATALOG_GROUP_META[key];
        const draft = items.some((item) => item.group === key && item.status === 'draft');
        return (
          <button
            key={key}
            type="button"
            className={`qt-cat-item${selected === key ? ' qt-cat-item--on' : ''}`}
            data-group={key}
            onClick={onSelect ? () => onSelect(key) : undefined}
          >
            {draft ? <span className="qt-pill qt-pill--info">Draft</span> : null}
            <h3>{meta.title}</h3>
            <p className="qt-muted">{meta.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

export function QtCatalogServiceRow({ item }: { item: QtCatalogItem }) {
  const canAdd = canAddToClientQuote(item);
  return (
    <article className="qt-svc" data-dv={item.dv_code} data-group={item.group ?? ''}>
      <div className="qt-svc__h">
        <h3>{catalogDisplayName(item)}</h3>
        {item.status === 'draft' ? <span className="qt-pill qt-pill--info">Draft</span> : null}
      </div>
      <p className="qt-muted">
        {item.dv_code || dash(null)}
        {item.template_key === VID_TPL_01 ? (
          <>
            {' · '}
            <Link className="qt-link" href={`/crm/proposals/catalog?template=${VID_TPL_01}`}>
              {VID_TPL_01}
            </Link>
          </>
        ) : null}
      </p>
      <div className="qt-catalog-add">
        <button type="button" className="qt-btn" disabled={!canAdd}>
          Thêm vào báo giá
        </button>
      </div>
    </article>
  );
}

export function QtVidTpl01Template() {
  return (
    <div className="qt-catalog qt-catalog--tpl">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Catalog / Template production</p>
          <h1>VID-TPL-01 · Brand Film / Reels storyboard</h1>
          <p className="qt-muted">
            CAT-05 · không phải màn quote · template deliverable → Video SOP / CP OS sau convert
          </p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn" href="/crm/proposals/catalog">
            Về catalog
          </Link>
          <button type="button" className="qt-btn qt-btn--primary" disabled>
            Dùng khi convert DV12
          </button>
        </div>
      </header>
      <div className="qt-grid2">
        <section className="qt-card">
          <p className="qt-muted">PTT × AN PHÁT</p>
          <h2>Brand Film 45s</h2>
          <p>6 scene · 1080×1920</p>
          <p>Hook → strategy → creative → performance/CRM → CTA ĐẶT LỊCH TƯ VẤN</p>
          <p className="qt-muted">Master dọc. VO + CTA library. QT không host editor video.</p>
        </section>
        <section className="qt-card">
          <div className="qt-table-wrap">
            <table className="qt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Scene</th>
                  <th>Thời lượng</th>
                </tr>
              </thead>
              <tbody>
                {VID_TPL_01_SCENES.map((row) => (
                  <tr key={row.n}>
                    <td>{row.n}</td>
                    <td>{row.scene}</td>
                    <td>{row.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="qt-muted">
            Template text. Khi line DV12 accepted → optional spawn /crm/video hoặc CP project.
          </p>
        </section>
      </div>
    </div>
  );
}

export function QtCatalogView({
  items,
  templateKey,
  selectedGroup,
  onSelectGroup,
  loading = false,
  error = '',
  onRetry,
}: {
  items: QtCatalogItem[];
  templateKey?: string | null;
  selectedGroup?: string | null;
  onSelectGroup?: (group: string) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  if (templateKey === VID_TPL_01) {
    return <QtVidTpl01Template />;
  }

  const visible = selectedGroup
    ? items.filter((item) => item.group === selectedGroup)
    : items;
  const hasVidTpl = items.some((item) => item.template_key === VID_TPL_01);

  return (
    <div className="qt-catalog">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Service Catalog</p>
          <h1>Service Catalog</h1>
          <p className="qt-muted">CAT-01 · 13 nhóm + package ngành · Active mới add quote client-facing</p>
        </div>
        <div className="qt-head__actions">
          {hasVidTpl ? (
            <Link className="qt-btn" href={`/crm/proposals/catalog?template=${VID_TPL_01}`}>
              VID-TPL-01
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          {onRetry ? (
            <button type="button" className="qt-btn" onClick={onRetry}>
              Thử lại
            </button>
          ) : null}
        </section>
      ) : null}

      <div aria-busy={loading}>
        <QtCatalogGroups items={items} selected={selectedGroup} onSelect={onSelectGroup} />
        <section className="qt-catalog-list">
          {visible.length ? (
            visible.map((item) => (
              <QtCatalogServiceRow key={item.dv_code || catalogDisplayName(item)} item={item} />
            ))
          ) : (
            <p className="qt-empty">{dash(null)}</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function QtCatalog() {
  const searchParams = useSearchParams();
  const templateKey = searchParams.get('template');
  const [items, setItems] = useState<QtCatalogItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setItems(await getQtQuoteCatalog(token));
    } catch (caught) {
      setItems([]);
      setError(caught instanceof Error ? caught.message : 'Không tải được catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groupParam = searchParams.get('group');
  const activeGroup = useMemo(
    () => selectedGroup ?? groupParam,
    [groupParam, selectedGroup],
  );

  return (
    <QtCatalogView
      items={items}
      templateKey={templateKey}
      selectedGroup={activeGroup}
      onSelectGroup={(group) => setSelectedGroup((current) => (current === group ? null : group))}
      loading={loading}
      error={error}
      onRetry={() => void load()}
    />
  );
}

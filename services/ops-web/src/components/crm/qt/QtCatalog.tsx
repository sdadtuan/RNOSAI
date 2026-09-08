'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import {
  getQtQuoteCatalogDoc,
  importQtCatalog,
  qtCatalogImportOutcome,
  snapshotQtCatalogPackage,
  type QtCatalogItem,
  type QtIndustryPackage,
  type QtRateCard,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import { QtCatalogImportPanel } from './QtSettings';

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

export const QT_CATALOG_DRAWER_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'deliverable', label: 'Deliverable' },
  { id: 'kpi', label: 'KPI' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'pricing', label: 'Pricing & Cost' },
  { id: 'policy', label: 'Proposal & Policy' },
] as const;

export type QtCatalogDrawerTabId = (typeof QT_CATALOG_DRAWER_TABS)[number]['id'];

export const QT_INDUSTRY_PACKAGE_FALLBACK: QtIndustryPackage[] = [
  { key: 'growth_launch', name: 'Growth Launch', package_discount_bps: 500, line_count: 4, dv_codes: ['DV05', 'DV08', 'DV03', 'DV12'] },
  { key: 'bds', name: 'BĐS', package_discount_bps: 500, line_count: 3, dv_codes: ['DV08', 'DV05', 'DV12'] },
  { key: 'spa_clinic', name: 'Spa/Clinic', package_discount_bps: 300, line_count: 2, dv_codes: ['DV05', 'DV08'] },
  { key: 'education', name: 'Education', package_discount_bps: 400, line_count: 3, dv_codes: ['DV08', 'DV05', 'DV03'] },
];

function textOrDash(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || dash(null);
}

function listOrDash(values?: string[] | null): string {
  return values?.length ? values.join(' · ') : dash(null);
}

export function asCatalogDrawerTab(value: string | null | undefined): QtCatalogDrawerTabId {
  return QT_CATALOG_DRAWER_TABS.some((tab) => tab.id === value)
    ? (value as QtCatalogDrawerTabId)
    : 'overview';
}

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

export function QtCatalogServiceRow({
  item,
  onOpen,
}: {
  item: QtCatalogItem;
  onOpen?: (item: QtCatalogItem) => void;
}) {
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
        <button type="button" className="qt-btn" onClick={onOpen ? () => onOpen(item) : undefined}>
          Chi tiết
        </button>
        <button type="button" className="qt-btn" disabled={!canAdd}>
          Thêm vào báo giá
        </button>
      </div>
    </article>
  );
}

export function QtCatalogDrawer({
  item,
  tab = 'overview',
  hasFinance = false,
  onTab,
  onClose,
}: {
  item: QtCatalogItem;
  tab?: string | null;
  hasFinance?: boolean;
  onTab?: (tab: QtCatalogDrawerTabId) => void;
  onClose?: () => void;
}) {
  const active = asCatalogDrawerTab(tab);
  const drawer = item.drawer;
  const canAdd = canAddToClientQuote(item);
  return (
    <section className="qt-drawer" data-screen="cat-02">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Catalog / {item.dv_code || dash(null)}</p>
          <h1>
            {catalogDisplayName(item)}
            {item.dv_code ? ` · ${item.dv_code}` : ''}
          </h1>
          <p className="qt-muted">CAT-02 · drawer 6 tab · snapshot vào line khi add</p>
        </div>
        <div className="qt-head__actions">
          {onClose ? (
            <button type="button" className="qt-btn" onClick={onClose}>
              Đóng
            </button>
          ) : (
            <Link className="qt-btn" href="/crm/proposals/catalog">
              Đóng
            </Link>
          )}
          <button type="button" className="qt-btn qt-btn--primary" disabled={!canAdd}>
            Thêm vào báo giá
          </button>
        </div>
      </header>
      <div className="qt-tabs">
        {QT_CATALOG_DRAWER_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`qt-tab${active === entry.id ? ' qt-tab--on' : ''}`}
            data-tab={entry.id}
            onClick={onTab ? () => onTab(entry.id) : undefined}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="qt-card" data-drawer-panel={active}>
        {active === 'overview' ? (
          <>
            <p>
              <b>Included</b> {listOrDash(drawer?.overview?.included)}
            </p>
            <p>
              <b>Excluded</b> {listOrDash(drawer?.overview?.excluded)}
            </p>
            <p>CTA {textOrDash(drawer?.overview?.cta)}</p>
            <p>UTA {textOrDash(drawer?.overview?.uta)}</p>
            <p className="qt-muted">
              Owner {textOrDash(drawer?.overview?.owner)} · Effort {textOrDash(drawer?.overview?.effort)}
            </p>
          </>
        ) : null}
        {active === 'deliverable' ? <p>{listOrDash(drawer?.deliverable?.items)}</p> : null}
        {active === 'kpi' ? (
          <>
            <p>committed: {textOrDash(drawer?.kpi?.committed)}</p>
            <p>optimization: {textOrDash(drawer?.kpi?.optimization)}</p>
            <p>forecast: {textOrDash(drawer?.kpi?.forecast)}</p>
          </>
        ) : null}
        {active === 'timeline' ? (
          <>
            <p>Kickoff {textOrDash(drawer?.timeline?.kickoff)}</p>
            <p>Duration {textOrDash(drawer?.timeline?.duration)}</p>
            <p className="qt-muted">{textOrDash(drawer?.timeline?.notes)}</p>
          </>
        ) : null}
        {active === 'pricing' ? (
          hasFinance && drawer?.pricing?.restricted !== true ? (
            <>
              <p>
                {drawer?.pricing?.package_tiers?.length
                  ? drawer.pricing.package_tiers
                      .map((tier) => `${tier.tier}: ${tier.suggested_vnd == null ? dash(null) : tier.suggested_vnd}`)
                      .join(' · ')
                  : dash(null)}
              </p>
              <p>Cost {textOrDash(drawer?.pricing?.cost_labor_vnd)}</p>
            </>
          ) : (
            <p className="qt-muted">Pricing &amp; Cost · cần crm_quote.finance · {dash(null)}</p>
          )
        ) : null}
        {active === 'policy' ? (
          <p>
            client_visible {drawer?.policy?.client_visible === false ? 'không' : 'mặc định'} · Studio{' '}
            {drawer?.policy?.studio_sections?.join(' + ') || '04 + 07'}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function QtCatalogPackages({
  packages,
  onAdd,
  addingKey,
}: {
  packages: QtIndustryPackage[];
  onAdd?: (key: string) => void;
  addingKey?: string | null;
}) {
  const rows = packages.length ? packages : QT_INDUSTRY_PACKAGE_FALLBACK;
  return (
    <section className="qt-catalog qt-catalog--packages" data-screen="cat-03">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Catalog / Package ngành</p>
          <h1>Package theo ngành</h1>
          <p className="qt-muted">CAT-03 · Growth Launch · BĐS · Spa/Clinic · Education · add = N line snapshot</p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn" href="/crm/proposals/catalog">
            Về lưới
          </Link>
        </div>
      </header>
      <div className="qt-grid2">
        {rows.map((pkg) => (
          <article key={pkg.key} className="qt-card" data-package={pkg.key}>
            <h3>{pkg.name}</h3>
            <p>
              {pkg.dv_codes.join(' + ') || dash(null)}
              {pkg.package_discount_bps
                ? ` · Discount package ${pkg.package_discount_bps / 100}%`
                : ''}
            </p>
            <p className="qt-muted">Add = {pkg.line_count} line snapshot.</p>
            <button
              type="button"
              className="qt-btn qt-btn--primary"
              disabled={pkg.can_add === false || addingKey === pkg.key}
              onClick={onAdd ? () => onAdd(pkg.key) : undefined}
            >
              Áp vào option
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function QtCatalogRates({
  cards,
  hasFinance = false,
  importing = false,
  importNotice = '',
  importError = '',
  onImport,
}: {
  cards: QtRateCard[];
  hasFinance?: boolean;
  importing?: boolean;
  importNotice?: string;
  importError?: string;
  onImport?: (file: File) => void | Promise<void>;
}) {
  return (
    <section className="qt-catalog qt-catalog--rates" data-screen="cat-04">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Catalog / Rate card</p>
          <h1>Rate card</h1>
          <p className="qt-muted">CAT-04 · effective_from/to · Active/Retired · hết hạn → rate_expired</p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn" href="/crm/proposals/catalog">
            Về lưới
          </Link>
        </div>
      </header>
      <QtCatalogImportPanel
        importing={importing}
        notice={importNotice}
        error={importError}
        onImport={onImport}
      />
      <div className="qt-table-wrap">
        <table className="qt-table">
          <thead>
            <tr>
              <th>dv_code</th>
              <th>SKU</th>
              <th>Fee</th>
              {hasFinance ? <th>Cost labor</th> : null}
              <th>Hiệu lực</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {cards.length ? (
              cards.map((card) => (
                <tr key={card.id} data-rate-expired={card.rate_expired ? '1' : '0'}>
                  <td>{card.dv_code || dash(null)}</td>
                  <td>{card.package_tier || dash(null)}</td>
                  <td>{card.fee_vnd == null ? dash(null) : card.fee_vnd}</td>
                  {hasFinance ? <td>{card.cost_labor_vnd == null ? dash(null) : card.cost_labor_vnd}</td> : null}
                  <td>
                    {card.effective_from || dash(null)}
                    {card.effective_to ? `–${card.effective_to}` : '–'}
                  </td>
                  <td>
                    <span className={`qt-pill${card.state === 'retired' ? '' : ' qt-pill--info'}`}>
                      {card.state === 'retired' ? 'Retired' : 'Active'}
                    </span>
                    {card.rate_expired ? <span className="qt-pill qt-pill--warn">rate_expired</span> : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={hasFinance ? 6 : 5} className="qt-empty">
                  {dash(null)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
  catalogTab,
  serviceSlug,
  drawerTab,
  packages = [],
  rateCards = [],
  hasFinance = false,
  addingPackage = null,
  onOpenService,
  onDrawerTab,
  onCloseDrawer,
  onAddPackage,
  loading = false,
  error = '',
  importing = false,
  importNotice = '',
  importError = '',
  onImportCatalog,
  onRetry,
}: {
  items: QtCatalogItem[];
  templateKey?: string | null;
  selectedGroup?: string | null;
  onSelectGroup?: (group: string) => void;
  catalogTab?: string | null;
  serviceSlug?: string | null;
  drawerTab?: string | null;
  packages?: QtIndustryPackage[];
  rateCards?: QtRateCard[];
  hasFinance?: boolean;
  addingPackage?: string | null;
  onOpenService?: (item: QtCatalogItem) => void;
  onDrawerTab?: (tab: QtCatalogDrawerTabId) => void;
  onCloseDrawer?: () => void;
  onAddPackage?: (key: string) => void;
  loading?: boolean;
  error?: string;
  importing?: boolean;
  importNotice?: string;
  importError?: string;
  onImportCatalog?: (file: File) => void | Promise<void>;
  onRetry?: () => void;
}) {
  if (templateKey === VID_TPL_01) {
    return <QtVidTpl01Template />;
  }
  if (catalogTab === 'packages') {
    return <QtCatalogPackages packages={packages} onAdd={onAddPackage} addingKey={addingPackage} />;
  }
  if (catalogTab === 'rates') {
    return (
      <QtCatalogRates
        cards={rateCards}
        hasFinance={hasFinance}
        importing={importing}
        importNotice={importNotice}
        importError={importError}
        onImport={onImportCatalog}
      />
    );
  }

  const drawerItem = serviceSlug
    ? items.find(
        (item) =>
          String(item.service_slug ?? '').toLowerCase() === serviceSlug.toLowerCase() ||
          String(item.dv_code ?? '').toLowerCase() === serviceSlug.toLowerCase(),
      ) ?? {
        dv_code: serviceSlug.toUpperCase(),
        name_vi: serviceSlug,
        status: 'draft',
        can_add_to_client_quote: false,
      }
    : null;

  if (drawerItem) {
    return (
      <QtCatalogDrawer
        item={drawerItem}
        tab={drawerTab}
        hasFinance={hasFinance}
        onTab={onDrawerTab}
        onClose={onCloseDrawer}
      />
    );
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
          <Link className="qt-btn" href="/crm/proposals/catalog?tab=packages">
            Package ngành
          </Link>
          <Link className="qt-btn" href="/crm/proposals/catalog?tab=rates">
            Rate card
          </Link>
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
              <QtCatalogServiceRow
                key={item.dv_code || catalogDisplayName(item)}
                item={item}
                onOpen={onOpenService}
              />
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
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/catalog';
  const templateKey = searchParams.get('template');
  const catalogTab = searchParams.get('tab');
  const serviceSlug = searchParams.get('service');
  const drawerTab = searchParams.get('drawer');
  const user = getStoredUser();
  const hasFinance = hasCap(user, 'crm_quote.finance', 'view');
  const [items, setItems] = useState<QtCatalogItem[]>([]);
  const [packages, setPackages] = useState<QtIndustryPackage[]>([]);
  const [rateCards, setRateCards] = useState<QtRateCard[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingPackage, setAddingPackage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const doc = await getQtQuoteCatalogDoc(token, {
        service: serviceSlug ?? undefined,
        tab: catalogTab ?? undefined,
      });
      const families = Array.isArray(doc.services)
        ? doc.services
        : Array.isArray(doc.families)
          ? doc.families
          : [];
      setItems(families);
      setPackages(Array.isArray(doc.packages) ? doc.packages : []);
      setRateCards(Array.isArray(doc.rate_cards) ? doc.rate_cards : []);
    } catch (caught) {
      setItems([]);
      setPackages([]);
      setRateCards([]);
      setError(caught instanceof Error ? caught.message : 'Không tải được catalog');
    } finally {
      setLoading(false);
    }
  }, [catalogTab, serviceSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupParam = searchParams.get('group');
  const activeGroup = useMemo(
    () => selectedGroup ?? groupParam,
    [groupParam, selectedGroup],
  );

  const replaceQuery = useCallback((next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return (
    <QtCatalogView
      items={items}
      templateKey={templateKey}
      selectedGroup={activeGroup}
      onSelectGroup={(group) => setSelectedGroup((current) => (current === group ? null : group))}
      catalogTab={catalogTab}
      serviceSlug={serviceSlug}
      drawerTab={drawerTab}
      packages={packages}
      rateCards={rateCards}
      hasFinance={hasFinance}
      addingPackage={addingPackage}
      onOpenService={(item) => {
        replaceQuery({ service: item.service_slug || item.dv_code, tab: null, drawer: 'overview' });
      }}
      onDrawerTab={(tab) => replaceQuery({ drawer: tab })}
      onCloseDrawer={() => replaceQuery({ service: null, drawer: null })}
      onAddPackage={async (key) => {
        const token = getAccessToken();
        if (!token) return;
        setAddingPackage(key);
        try {
          await snapshotQtCatalogPackage(token, key);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không thêm được package');
        } finally {
          setAddingPackage(null);
        }
      }}
      loading={loading}
      error={error}
      importing={importing}
      importNotice={importNotice}
      importError={error}
      onImportCatalog={async (file) => {
        const token = getAccessToken();
        if (!token) return;
        setImporting(true);
        setError('');
        setImportNotice('');
        try {
          const text = await file.text();
          const isJson = /\.json$/i.test(file.name) || text.trim().startsWith('{') || text.trim().startsWith('[');
          const out = await importQtCatalog(token, {
            filename: file.name,
            ...(isJson ? { json: JSON.parse(text) } : { csv: text }),
          });
          const outcome = qtCatalogImportOutcome(out);
          if (!outcome.ok) {
            setError(outcome.error);
            return;
          }
          setImportNotice(outcome.notice);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không nhập được catalog');
        } finally {
          setImporting(false);
        }
      }}
      onRetry={() => void load()}
    />
  );
}

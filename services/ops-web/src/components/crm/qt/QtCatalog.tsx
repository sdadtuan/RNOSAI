'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import {
  createQtCatalogGroup,
  createQtCatalogService,
  deleteQtCatalogGroup,
  deleteQtCatalogService,
  getQtQuoteCatalogDoc,
  importQtCatalog,
  qtCatalogImportOutcome,
  snapshotQtCatalogPackage,
  updateQtCatalogGroup,
  updateQtCatalogService,
  type QtCatalogGroup,
  type QtCatalogItem,
  type QtIndustryPackage,
  type QtRateCard,
} from '@/lib/crm/qt-api';
import { QtCatalogOs, asCatalogGroups } from './QtCatalogOs';
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
  { title: string; hint: string; description: string; icon: string }
> = {
  strategy: { title: 'Strategy & Research', hint: 'DV12 · audit / GTM', description: 'Discovery, audit, research, strategy, GTM và consulting.', icon: '✦' },
  branding: { title: 'Branding & Creative', hint: 'DV01 · CB/TC/CS', description: 'Định vị, nhận diện, creative concept và brand asset.', icon: '◇' },
  content: { title: 'Content & Social', hint: 'DV02 · CB/TC/CS', description: 'Content strategy, social operation, copywriting và community.', icon: '✎' },
  production: { title: 'Video & Image Production', hint: 'DV15 · Reels · Brand Film', description: 'Pre-production, video, image, motion và livestream.', icon: '▶' },
  performance: { title: 'Performance & Media', hint: 'DV04 kênh · DV18 plan · DV19 TMĐT', description: 'Paid media, media buying, TMĐT và growth ads.', icon: '◉' },
  web: { title: 'Web, Landing Page & CRO', hint: 'DV03', description: 'UX/UI, website, landing page, tracking và CRO.', icon: '▣' },
  seo: { title: 'SEO, AEO/GEO & Organic', hint: 'DV05 · 3 line', description: 'Technical SEO, content SEO, local SEO và AI-search.', icon: '⌕' },
  crm: { title: 'CRM, Automation & AI', hint: 'DV07–11 · không phải Draft mặc định', description: 'CRM, lead routing, automation, chatbot và dashboard.', icon: '♟' },
  retention: { title: 'Email & Retention', hint: 'DV20 · DV06', description: 'Lifecycle, nurture, reactivation và reminders.', icon: '↻' },
  pr: { title: 'PR, KOL & Reputation', hint: 'DV14 · DV16', description: 'PR, media relations, KOL/KOC và ORM.', icon: '◌' },
  event: { title: 'Event & Activation', hint: 'DV17 · DV21 POSM', description: 'Event, launch, activation, roadshow và POSM.', icon: '★' },
  sales: { title: 'Sales Enablement B2B', hint: 'Không phải DV mới — chỉ khi có owner', description: 'Sales deck, ABM, outreach và pitch support.', icon: '↗' },
  data: { title: 'Data & Analytics', hint: 'DV13', description: 'GA4/GTM, attribution, reporting và dashboard.', icon: '▤' },
  package: { title: 'Package theo ngành', hint: 'Nổ ra line DV + discount', description: 'Gói N line DV + discount, không tạo family mới.', icon: '▣' },
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
  { key: 'growth_launch', name: 'Growth Launch', package_discount_bps: 500, line_count: 4, dv_codes: ['DV12', 'DV04', 'DV03', 'DV02'] },
  { key: 'bds', name: 'BĐS Lead Launch', package_discount_bps: 500, line_count: 6, dv_codes: ['DV12', 'DV04', 'DV03', 'DV15', 'DV08', 'DV13'] },
  { key: 'spa_clinic', name: 'Spa/Clinic Lead Growth', package_discount_bps: 300, line_count: 5, dv_codes: ['DV04', 'DV02', 'DV03', 'DV11', 'DV06'] },
  { key: 'education', name: 'Education Student Recruitment', package_discount_bps: 400, line_count: 4, dv_codes: ['DV04', 'DV03', 'DV08', 'DV02'] },
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
  onSelect?: (group: string | null) => void;
}) {
  const keys = catalogGroupKeys(items);
  return (
    <div className="qt-cat-grid" role="tablist" aria-label="Lọc nhóm Portfolio">
      <button
        type="button"
        className={`qt-cat-item${selected ? '' : ' qt-cat-item--on'}`}
        data-filter="all"
        onClick={onSelect ? () => onSelect(null) : undefined}
      >
        <h3>Tất cả</h3>
        <p className="qt-muted">Portfolio 21 DV</p>
      </button>
      {keys.map((key) => {
        const meta = QT_CATALOG_GROUP_META[key];
        const count = items.filter((item) => item.group === key).length;
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
            <p className="qt-muted">
              {count ? `${count} DV` : meta.hint}
            </p>
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
  const skus = item.sku_codes?.length ? item.sku_codes : item.dv_code ? [`${item.dv_code}-CB`, `${item.dv_code}-TC`, `${item.dv_code}-CS`] : [];
  return (
    <article className="qt-svc" data-dv={item.dv_code} data-group={item.group ?? ''}>
      <div className="qt-svc__h">
        <h3>{catalogDisplayName(item)}</h3>
        {item.status === 'draft' ? <span className="qt-pill qt-pill--info">Draft</span> : null}
      </div>
      <p className="qt-muted">
        {item.dv_code || dash(null)}
        {skus.length ? ` · ${skus[1] || skus[0]}` : ''}
        {item.media_pass_through ? ' · media tách fee' : ''}
        {item.template_key === VID_TPL_01 ? (
          <>
            {' · '}
            <Link className="qt-link" href={`/crm/proposals/catalog?template=${VID_TPL_01}`}>
              {VID_TPL_01}
            </Link>
          </>
        ) : null}
      </p>
      {item.summary_vi ? <p className="qt-muted">{item.summary_vi}</p> : null}
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
              <b>SKU</b> {listOrDash(item.sku_codes ?? drawer?.policy?.sku_codes)}
            </p>
            <p>
              <b>Included</b> {listOrDash(drawer?.overview?.included)}
            </p>
            <p>
              <b>Excluded</b> {listOrDash(drawer?.overview?.excluded)}
            </p>
            <p>
              <b>Assumption</b> {listOrDash(drawer?.overview?.assume)}
            </p>
            <p>
              <b>Line / kênh</b> {listOrDash(drawer?.overview?.channel_lines ?? item.channel_lines)}
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
            {drawer?.kpi?.items?.length ? (
              <ul className="qt-drawer-list">
                {drawer.kpi.items.map((row) => (
                  <li key={`${row.kind}-${row.name}`}>
                    {row.kind} · {row.name}: {row.value}
                  </li>
                ))}
              </ul>
            ) : null}
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
              <p>Media/pass-through {drawer?.pricing?.media_pass_through || item.media_pass_through ? 'tách fee' : 'không'}</p>
            </>
          ) : (
            <p className="qt-muted">Pricing &amp; Cost · cần crm_quote.finance · {dash(null)}</p>
          )
        ) : null}
        {active === 'policy' ? (
          <p>
            client_visible {drawer?.policy?.client_visible === false ? 'không' : 'mặc định'} · Studio{' '}
            {drawer?.policy?.studio_sections?.join(' + ') || '04 + 07'}
            {drawer?.policy?.assumptions_required ? ' · assumption bắt buộc trên proposal' : ''}
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
          <p className="qt-muted">CAT-03 · bundle DV + discount · không tạo family mới · add = N line snapshot</p>
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
            Dùng khi convert DV15
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
            Template text. Khi line DV15 accepted → optional spawn /crm/video hoặc CP project.
          </p>
        </section>
      </div>
    </div>
  );
}

export function QtCatalogView({
  items,
  groups = [],
  templateKey,
  selectedGroup,
  onSelectGroup,
  catalogTab,
  serviceSlug,
  drawerTab,
  packages = [],
  rateCards = [],
  hasFinance = false,
  canManage = false,
  addingPackage = null,
  onOpenService,
  onDrawerTab,
  onCloseDrawer,
  onAddPackage,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateService,
  onUpdateService,
  onDeleteService,
  loading = false,
  error = '',
  importing = false,
  importNotice = '',
  importError = '',
  onImportCatalog,
  onRetry,
}: {
  items: QtCatalogItem[];
  groups?: QtCatalogGroup[];
  templateKey?: string | null;
  selectedGroup?: string | null;
  onSelectGroup?: (group: string | null) => void;
  catalogTab?: string | null;
  serviceSlug?: string | null;
  drawerTab?: string | null;
  packages?: QtIndustryPackage[];
  rateCards?: QtRateCard[];
  hasFinance?: boolean;
  canManage?: boolean;
  addingPackage?: string | null;
  onOpenService?: (item: QtCatalogItem) => void;
  onDrawerTab?: (tab: QtCatalogDrawerTabId) => void;
  onCloseDrawer?: () => void;
  onAddPackage?: (key: string) => void;
  onCreateGroup?: (body: { title: string; description?: string; icon?: string }) => Promise<void>;
  onUpdateGroup?: (key: string, body: { title?: string; description?: string; icon?: string }) => Promise<void>;
  onDeleteGroup?: (key: string) => Promise<void>;
  onCreateService?: (body: { name: string; group_key: string; description?: string }) => Promise<void>;
  onUpdateService?: (
    dv: string,
    body: { name?: string; group_key?: string; description?: string; active?: boolean },
  ) => Promise<void>;
  onDeleteService?: (dv: string) => Promise<void>;
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

  return (
    <div className="qt-catalog">
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
      <QtCatalogOs
        items={items}
        groups={asCatalogGroups(groups, items)}
        packages={packages}
        selectedGroup={selectedGroup}
        onSelectGroup={onSelectGroup}
        onOpenService={onOpenService}
        canManage={canManage}
        loading={loading}
        onCreateGroup={onCreateGroup}
        onUpdateGroup={onUpdateGroup}
        onDeleteGroup={onDeleteGroup}
        onCreateService={onCreateService}
        onUpdateService={onUpdateService}
        onDeleteService={onDeleteService}
      />
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
  const canManage = hasCap(user, 'crm_quote.catalog', 'manage');
  const [items, setItems] = useState<QtCatalogItem[]>([]);
  const [groups, setGroups] = useState<QtCatalogGroup[]>([]);
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
    if (!token) {
      setItems([]);
      setPackages([]);
      setRateCards([]);
      setError('Chưa đăng nhập — không tải được Portfolio 21 DV');
      setLoading(false);
      return;
    }
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
      setGroups(asCatalogGroups(doc.groups, families));
      setPackages(Array.isArray(doc.packages) ? doc.packages : []);
      setRateCards(Array.isArray(doc.rate_cards) ? doc.rate_cards : []);
    } catch (caught) {
      setItems([]);
      setGroups([]);
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
      groups={groups}
      templateKey={templateKey}
      selectedGroup={activeGroup}
      onSelectGroup={(group) => {
        const next = group && activeGroup === group ? null : group;
        setSelectedGroup(next);
        replaceQuery({ group: next });
      }}
      catalogTab={catalogTab}
      serviceSlug={serviceSlug}
      drawerTab={drawerTab}
      packages={packages}
      rateCards={rateCards}
      hasFinance={hasFinance}
      canManage={canManage}
      addingPackage={addingPackage}
      onOpenService={(item) => {
        replaceQuery({ service: item.service_slug || item.dv_code, tab: null, drawer: 'overview' });
      }}
      onDrawerTab={(tab) => replaceQuery({ drawer: tab })}
      onCloseDrawer={() => replaceQuery({ service: null, drawer: null })}
      onCreateGroup={async (body) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await createQtCatalogGroup(token, body);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không tạo được nhóm');
          throw caught;
        }
      }}
      onUpdateGroup={async (key, body) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await updateQtCatalogGroup(token, key, body);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không sửa được nhóm');
          throw caught;
        }
      }}
      onDeleteGroup={async (key) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await deleteQtCatalogGroup(token, key);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không xóa được nhóm');
        }
      }}
      onCreateService={async (body) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await createQtCatalogService(token, body);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không tạo được dịch vụ');
          throw caught;
        }
      }}
      onUpdateService={async (dv, body) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await updateQtCatalogService(token, dv, body);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không sửa được dịch vụ');
          throw caught;
        }
      }}
      onDeleteService={async (dv) => {
        const token = getAccessToken();
        if (!token) return;
        try {
          await deleteQtCatalogService(token, dv);
          await load();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Không xóa được dịch vụ');
        }
      }}
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

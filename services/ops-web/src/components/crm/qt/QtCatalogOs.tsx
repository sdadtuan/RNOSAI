'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import type { QtCatalogGroup, QtCatalogItem, QtIndustryPackage } from '@/lib/crm/qt-api';
import { dash, formatQtVnd } from '@/lib/crm/qt-format';
import { QT_CATALOG_GROUP_META, QT_CATALOG_NAV_GROUPS, catalogDisplayName, canAddToClientQuote } from './QtCatalog';

export type QtCatalogStatusFilter = 'all' | 'active' | 'recommended' | 'package';

type EditorState =
  | { kind: 'group'; mode: 'create'; group?: undefined }
  | { kind: 'group'; mode: 'edit'; group: QtCatalogGroup }
  | { kind: 'service'; mode: 'create'; item?: undefined; groupKey?: string }
  | { kind: 'service'; mode: 'edit'; item: QtCatalogItem };

export function asCatalogGroups(groups: unknown, items: QtCatalogItem[]): QtCatalogGroup[] {
  if (Array.isArray(groups) && groups.length && typeof groups[0] === 'object' && groups[0] && 'key' in (groups[0] as object)) {
    return (groups as QtCatalogGroup[]).map((group) => ({
      ...group,
      service_count:
        group.service_count ?? items.filter((item) => item.group === group.key).length,
    }));
  }
  const keys = [
    ...QT_CATALOG_NAV_GROUPS,
    ...(items.some((item) => item.group === 'package') ? (['package'] as const) : []),
  ];
  return keys.map((key) => {
    const meta = QT_CATALOG_GROUP_META[key];
    return {
      key,
      title: meta.title,
      description: meta.description,
      icon: meta.icon,
      system: true,
      service_count: items.filter((item) => item.group === key).length,
    };
  });
}

function groupMeta(group: QtCatalogGroup) {
  const known = QT_CATALOG_GROUP_META[group.key as keyof typeof QT_CATALOG_GROUP_META];
  return {
    title: group.title || known?.title || group.key,
    description: group.description || known?.description || known?.hint || '',
    icon: group.icon || known?.icon || '▣',
  };
}

export function QtCatalogOs({
  items,
  groups = [],
  packages = [],
  selectedGroup = null,
  onSelectGroup,
  onOpenService,
  canManage = false,
  loading = false,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateService,
  onUpdateService,
  onDeleteService,
}: {
  items: QtCatalogItem[];
  groups?: QtCatalogGroup[];
  packages?: QtIndustryPackage[];
  selectedGroup?: string | null;
  onSelectGroup?: (group: string | null) => void;
  onOpenService?: (item: QtCatalogItem) => void;
  canManage?: boolean;
  loading?: boolean;
  onCreateGroup?: (body: { title: string; description?: string; icon?: string }) => Promise<void>;
  onUpdateGroup?: (key: string, body: { title?: string; description?: string; icon?: string }) => Promise<void>;
  onDeleteGroup?: (key: string) => Promise<void>;
  onCreateService?: (body: { name: string; group_key: string; description?: string }) => Promise<void>;
  onUpdateService?: (
    dv: string,
    body: { name?: string; group_key?: string; description?: string; active?: boolean },
  ) => Promise<void>;
  onDeleteService?: (dv: string) => Promise<void>;
}) {
  const nav = asCatalogGroups(groups, items);
  const [filter, setFilter] = useState<QtCatalogStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    let rows = selectedGroup ? items.filter((item) => item.group === selectedGroup) : items;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((item) =>
        `${catalogDisplayName(item)} ${item.dv_code} ${item.summary_vi ?? ''} ${(item.tags ?? []).join(' ')}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (filter === 'active') rows = rows.filter((item) => item.status === 'active');
    if (filter === 'recommended') rows = rows.filter((item) => item.recommended);
    if (filter === 'package') rows = rows.filter((item) => item.group === 'package');
    if (visibility === 'client') rows = rows.filter((item) => item.client_visible !== false);
    if (visibility === 'internal') rows = rows.filter((item) => item.client_visible === false);
    return rows;
  }, [filter, items, search, selectedGroup, visibility]);

  const activeCount = items.filter((item) => item.status === 'active' && item.group !== 'package').length;
  const deliverableCount = items.reduce((sum, item) => sum + (item.drawer?.deliverable?.items?.length ?? 0), 0);
  const kpiCount = items.reduce((sum, item) => sum + (item.drawer?.kpi?.items?.length ?? 0), 0);
  const groupCount = nav.filter((group) => group.key !== 'package').length;
  const selectedMeta = selectedGroup
    ? nav.find((group) => group.key === selectedGroup)
    : { key: 'all', title: 'Tất cả dịch vụ', description: 'Portfolio DV01–21 có thể cấu hình vào báo giá.', icon: '▦' };
  const banner = selectedMeta ? groupMeta(selectedMeta as QtCatalogGroup) : groupMeta({ key: 'all', title: 'Tất cả dịch vụ' });

  async function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    try {
      if (editor.kind === 'group') {
        const body = {
          title: String(data.get('title') ?? '').trim(),
          description: String(data.get('description') ?? '').trim(),
          icon: String(data.get('icon') ?? '').trim() || undefined,
        };
        if (editor.mode === 'create') await onCreateGroup?.(body);
        else await onUpdateGroup?.(editor.group.key, body);
      } else {
        const body = {
          name: String(data.get('name') ?? '').trim(),
          group_key: String(data.get('group_key') ?? '').trim(),
          description: String(data.get('description') ?? '').trim(),
          active: data.get('active') === 'on',
        };
        if (editor.mode === 'create') await onCreateService?.(body);
        else if (editor.item) await onUpdateService?.(editor.item.dv_code, body);
      }
      setEditor(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qt-os" data-screen="cat-01">
      <header className="qt-os-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Service Catalog</p>
          <h1>Service Catalog — Full-service Agency</h1>
          <p className="qt-muted">
            Portfolio DV01–21 theo nhóm dịch vụ: scope, deliverable, KPI, CTA/UTA, rate card.
          </p>
        </div>
        <div className="qt-os-actions">
          <input
            className="qt-os-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm service, DV, KPI, CTA..."
            aria-label="Tìm catalog"
          />
          <Link className="qt-btn" href="/crm/proposals/catalog?tab=rates">
            Import
          </Link>
          <Link className="qt-btn" href="/crm/proposals/catalog?tab=packages">
            + Tạo Package
          </Link>
          {canManage ? (
            <button type="button" className="qt-btn qt-btn--primary" onClick={() => setEditor({ kind: 'service', mode: 'create', groupKey: selectedGroup ?? undefined })}>
              + Thêm Service
            </button>
          ) : null}
        </div>
      </header>

      <div className="qt-os-layout">
        <aside className="qt-os-side" aria-label="Nhóm dịch vụ">
          <div className="qt-os-side__h">
            <h2>Nhóm dịch vụ</h2>
            {canManage ? (
              <button type="button" className="qt-os-iconbtn" onClick={() => setEditor({ kind: 'group', mode: 'create' })}>
                +
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={`qt-os-cat${selectedGroup ? '' : ' qt-os-cat--on'}`}
            data-filter="all"
            onClick={() => onSelectGroup?.(null)}
          >
            <span className="qt-os-ico">▦</span>
            Tất cả
            <span className="qt-os-count">{items.length}</span>
          </button>
          {nav.map((group) => {
            const meta = groupMeta(group);
            return (
              <div key={group.key} className="qt-os-catwrap">
                <button
                  type="button"
                  className={`qt-os-cat${selectedGroup === group.key ? ' qt-os-cat--on' : ''}`}
                  data-group={group.key}
                  onClick={() => onSelectGroup?.(group.key)}
                >
                  <span className="qt-os-ico">{meta.icon}</span>
                  {meta.title}
                  <span className="qt-os-count">{group.service_count ?? 0}</span>
                </button>
                {canManage ? (
                  <span className="qt-os-catacts">
                    <button type="button" onClick={() => setEditor({ kind: 'group', mode: 'edit', group })}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Xóa nhóm "${meta.title}"?`)) void onDeleteGroup?.(group.key);
                      }}
                    >
                      Xóa
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
          <p className="qt-os-note">
            <b>Quy tắc</b>
            <br />
            Service Active có Rate Card hợp lệ mới add vào Quote. Draft cần kích hoạt.
          </p>
        </aside>

        <section className="qt-os-main">
          <div className="qt-os-filters">
            {(
              [
                ['all', 'Tất cả'],
                ['active', 'Đang hoạt động'],
                ['recommended', 'Recommended'],
                ['package', 'Package'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`qt-os-filter${filter === id ? ' qt-os-filter--on' : ''}`}
                data-status-filter={id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
            <label className="qt-os-filter">
              Visibility:{' '}
              <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="">Tất cả</option>
                <option value="client">Client-facing</option>
                <option value="internal">Internal only</option>
              </select>
            </label>
            <span className="qt-os-filter">Rate card: HCM 2026</span>
          </div>

          <div className="qt-os-summary">
            <article className="qt-os-sum">
              <span>SERVICE ACTIVE</span>
              <b>{activeCount}</b>
              <small>Được phép add vào Quote</small>
            </article>
            <article className="qt-os-sum">
              <span>NHÓM DỊCH VỤ</span>
              <b>{groupCount}</b>
              <small>Full-service capability</small>
            </article>
            <article className="qt-os-sum">
              <span>DELIVERABLE TEMPLATE</span>
              <b>{deliverableCount}</b>
              <small>Content, image, video, media</small>
            </article>
            <article className="qt-os-sum">
              <span>KPI TEMPLATE</span>
              <b>{kpiCount}</b>
              <small>Committed, target, forecast</small>
            </article>
            <article className="qt-os-sum">
              <span>PACKAGE THEO NGÀNH</span>
              <b>{packages.length}</b>
              <small>Real Estate, Spa, Education</small>
            </article>
          </div>

          <article className="qt-os-banner">
            <div>
              <h2>{banner.title}</h2>
              <p>{banner.description}</p>
            </div>
            <span className="qt-os-badge">{visible.length} services</span>
          </article>

          <div className="qt-os-grid" aria-busy={loading}>
            {visible.length ? (
              visible.map((item) => {
                const meta = groupMeta({
                  key: item.group || 'strategy',
                  title: '',
                  icon: QT_CATALOG_GROUP_META[(item.group || 'strategy') as keyof typeof QT_CATALOG_GROUP_META]?.icon,
                });
                const tags = (item.tags?.length ? item.tags : [item.dv_code, item.group].filter(Boolean) as string[]).slice(0, 3);
                const kpis = item.drawer?.kpi?.items ?? [];
                return (
                  <article key={item.dv_code || catalogDisplayName(item)} className="qt-os-svc" data-dv={item.dv_code} data-group={item.group ?? ''}>
                    <div className="qt-os-svc__h">
                      <span className="qt-os-svcico">{meta.icon}</span>
                      <span className={`qt-os-badge ${item.status === 'active' ? 'qt-os-badge--on' : 'qt-os-badge--draft'}`}>
                        {item.status === 'active' ? '● Active' : '◐ Draft'}
                      </span>
                    </div>
                    <h3>{catalogDisplayName(item)}</h3>
                    <p>{item.summary_vi || dash(null)}</p>
                    <div className="qt-os-tags">
                      {tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                      {item.recommended ? <span className="qt-os-tag--rec">Recommended</span> : null}
                    </div>
                    <div className="qt-os-mini">
                      <div>
                        <b>{kpis[0]?.value || item.dv_code || dash(null)}</b>
                        <span>{kpis[0]?.name || 'SKU'}</span>
                      </div>
                      <div>
                        <b>{item.effort || dash(null)}</b>
                        <span>Effort</span>
                      </div>
                      <div>
                        <b>{item.duration || dash(null)}</b>
                        <span>Thời gian</span>
                      </div>
                    </div>
                    <div className="qt-os-svc__f">
                      <div>
                        <b>{formatQtVnd(item.price_vnd)}</b>
                        <span>
                          {item.price_unit || '/ project'}
                          {item.media_pass_through ? ' · +media' : ''}
                        </span>
                      </div>
                      <div className="qt-os-svcacts">
                        {canManage ? (
                          <>
                            <button type="button" className="qt-btn qt-btn--sm" onClick={() => setEditor({ kind: 'service', mode: 'edit', item })}>
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="qt-btn qt-btn--sm"
                              onClick={() => {
                                if (window.confirm(`Xóa dịch vụ ${catalogDisplayName(item)}?`)) void onDeleteService?.(item.dv_code);
                              }}
                            >
                              Xóa
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="qt-btn qt-btn--sm" onClick={() => onOpenService?.(item)}>
                          Chi tiết →
                        </button>
                      </div>
                    </div>
                    {!canAddToClientQuote(item) ? <p className="qt-os-warn">Chưa add được vào Quote client-facing</p> : null}
                  </article>
                );
              })
            ) : (
              <p className="qt-empty">{loading ? 'Đang tải Portfolio 21 DV…' : 'Không tìm thấy service phù hợp.'}</p>
            )}
          </div>
        </section>
      </div>

      {editor ? (
        <div className="qt-os-modalbg" role="presentation" onClick={() => setEditor(null)}>
          <form className="qt-os-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void submitEditor(event)}>
            <header>
              <h2>
                {editor.kind === 'group'
                  ? editor.mode === 'create'
                    ? 'Thêm nhóm dịch vụ'
                    : 'Sửa nhóm dịch vụ'
                  : editor.mode === 'create'
                    ? 'Thêm dịch vụ'
                    : 'Sửa dịch vụ'}
              </h2>
              <button type="button" className="qt-os-iconbtn" onClick={() => setEditor(null)}>
                ×
              </button>
            </header>
            <div className="qt-os-form">
              {editor.kind === 'group' ? (
                <>
                  <label>
                    Tên nhóm *
                    <input name="title" defaultValue={editor.mode === 'edit' ? editor.group.title : ''} required />
                  </label>
                  <label>
                    Icon
                    <input name="icon" defaultValue={editor.mode === 'edit' ? editor.group.icon : '▣'} />
                  </label>
                  <label className="qt-os-full">
                    Mô tả
                    <textarea name="description" defaultValue={editor.mode === 'edit' ? editor.group.description : ''} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Tên dịch vụ *
                    <input name="name" defaultValue={editor.mode === 'edit' ? catalogDisplayName(editor.item) : ''} required />
                  </label>
                  <label>
                    Nhóm dịch vụ
                    <select name="group_key" defaultValue={editor.mode === 'edit' ? editor.item.group : editor.groupKey || nav[0]?.key}>
                      {nav.filter((group) => group.key !== 'package').map((group) => (
                        <option key={group.key} value={group.key}>
                          {groupMeta(group).title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="qt-os-full">
                    Mô tả
                    <textarea
                      name="description"
                      defaultValue={editor.mode === 'edit' ? editor.item.summary_vi ?? '' : ''}
                    />
                  </label>
                  {editor.mode === 'edit' ? (
                    <label className="qt-os-check">
                      <input name="active" type="checkbox" defaultChecked={editor.item.status === 'active'} /> Active
                    </label>
                  ) : (
                    <p className="qt-muted">Service mới ở trạng thái Draft. Bật Active sau khi có Rate Card.</p>
                  )}
                </>
              )}
            </div>
            <footer>
              <button type="button" className="qt-btn" onClick={() => setEditor(null)}>
                Hủy
              </button>
              <button type="submit" className="qt-btn qt-btn--primary" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}

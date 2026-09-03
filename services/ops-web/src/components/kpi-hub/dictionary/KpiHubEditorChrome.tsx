'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'formula', label: 'Công thức & Logic' },
  { id: 'source', label: 'Nguồn dữ liệu' },
  { id: 'target', label: 'Target' },
  { id: 'governance', label: 'Governance' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Props = {
  row: KpiHubDictionaryRow;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: ReactNode;
  onSaveDraft?: () => void;
  onPublish?: () => void;
};

export function KpiHubEditorChrome({ row, breadcrumb, children, onSaveDraft, onPublish }: Props) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const activeTab = (searchParams?.get('tab') as TabId) || 'overview';
  const base = pathname.split('?')[0];

  return (
    <div className="kpi-hub-editor">
      <div className="kpi-hub-editor__head">
        <div>
          {breadcrumb?.length ? (
            <nav className="kpi-hub-breadcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="kpi-hub-breadcrumb__item">
                  {i > 0 ? <span className="kpi-hub-breadcrumb__sep">/</span> : null}
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="kpi-hub-editor__title-row">
            <h1>{row.name}</h1>
            <KpiHubStatusBadge kind="dict" status={row.status} />
          </div>
          <span className="kpi-hub-table__mono">{row.code}</span>
        </div>
        <div className="kpi-hub-editor__actions">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onSaveDraft}>
            Lưu nháp
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={onPublish}>
            Lưu & Xuất bản
          </button>
        </div>
      </div>
      <nav className="kpi-hub-tabs" aria-label="Editor tabs">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`${base}?tab=${tab.id}`}
            className={`kpi-hub-tabs__item${activeTab === tab.id ? ' is-active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="kpi-hub-editor__body">{children}</div>
    </div>
  );
}

export function useKpiHubEditorTab(): TabId {
  const searchParams = useSearchParams();
  return (searchParams?.get('tab') as TabId) || 'overview';
}

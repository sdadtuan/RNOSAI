import { PortalPage } from '@/components/layout/PortalPage';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { portalPageTitle } from '@/lib/portal/nav';

export type PortalRouteSkeletonProps = {
  href?: string;
  title?: string;
  variant?: SkeletonVariant;
};

export type SkeletonVariant = 'table' | 'inbox' | 'cards' | 'report' | 'settings' | 'default';

export function skeletonVariantFor(href: string): SkeletonVariant {
  const p = href || '';
  if (p.startsWith('/crm/messages')) return 'inbox';
  if (p.startsWith('/crm/sales') || p.startsWith('/seo/reports') || p.startsWith('/research')) return 'report';
  if (
    p.startsWith('/crm/leads') ||
    p.startsWith('/crm/customers') ||
    p.startsWith('/crm/orders') ||
    p === '/products' ||
    p.startsWith('/products/')
  ) {
    return 'table';
  }
  if (p.startsWith('/settings') || p.startsWith('/crm/shipping')) return 'settings';
  if (p.startsWith('/dashboard') || p === '/crm' || p.startsWith('/creatives') || p.startsWith('/notifications')) {
    return 'cards';
  }
  return 'default';
}

function Bone({ className = '' }: { className?: string }) {
  return <span className={`portal-skeleton-bone ${className}`.trim()} />;
}

function TableSkeleton() {
  return (
    <div className="portal-skeleton-table" aria-hidden="true">
      <div className="portal-skeleton-toolbar">
        <Bone className="portal-skeleton-bone--search" />
        <Bone className="portal-skeleton-bone--btn" />
      </div>
      <div className="portal-skeleton-thead">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="portal-skeleton-bone--th" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, r) => (
        <div key={r} className="portal-skeleton-tr">
          {Array.from({ length: 5 }).map((_, c) => (
            <Bone key={c} className="portal-skeleton-bone--td" />
          ))}
        </div>
      ))}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="portal-skeleton-inbox" aria-hidden="true">
      <div className="portal-skeleton-inbox__list">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="portal-skeleton-inbox__item">
            <Bone className="portal-skeleton-bone--avatar" />
            <div className="portal-skeleton-inbox__meta">
              <Bone className="portal-skeleton-bone--line" />
              <Bone className="portal-skeleton-bone--line portal-skeleton-bone--short" />
            </div>
          </div>
        ))}
      </div>
      <div className="portal-skeleton-inbox__thread">
        <Bone className="portal-skeleton-bone--line portal-skeleton-bone--wide" />
        <Bone className="portal-skeleton-bone--block" />
        <Bone className="portal-skeleton-bone--block" />
        <Bone className="portal-skeleton-bone--line" />
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="portal-skeleton-cards" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="portal-skeleton-card">
          <Bone className="portal-skeleton-bone--line portal-skeleton-bone--short" />
          <Bone className="portal-skeleton-bone--kpi" />
          <Bone className="portal-skeleton-bone--line" />
        </div>
      ))}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="portal-skeleton-report" aria-hidden="true">
      <div className="portal-skeleton-cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="portal-skeleton-card">
            <Bone className="portal-skeleton-bone--line portal-skeleton-bone--short" />
            <Bone className="portal-skeleton-bone--kpi" />
          </div>
        ))}
      </div>
      <Bone className="portal-skeleton-bone--chart" />
      <TableSkeleton />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="portal-skeleton-settings" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="portal-skeleton-settings__row">
          <Bone className="portal-skeleton-bone--label" />
          <Bone className="portal-skeleton-bone--input" />
        </div>
      ))}
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div className="portal-skeleton-default" aria-hidden="true">
      <Bone className="portal-skeleton-bone--block" />
      <Bone className="portal-skeleton-bone--line portal-skeleton-bone--wide" />
      <Bone className="portal-skeleton-bone--line" />
      <Bone className="portal-skeleton-bone--block" />
    </div>
  );
}

function VariantBody({ variant }: { variant: SkeletonVariant }) {
  switch (variant) {
    case 'table':
      return <TableSkeleton />;
    case 'inbox':
      return <InboxSkeleton />;
    case 'cards':
      return <CardsSkeleton />;
    case 'report':
      return <ReportSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    default:
      return <DefaultSkeleton />;
  }
}

export function PortalRouteSkeleton({ href, title, variant }: PortalRouteSkeletonProps) {
  const t = title || (href ? portalPageTitle(href) : 'Đang tải…');
  const v = variant || skeletonVariantFor(href || '');
  return (
    <PortalPage
      breadcrumb={[
        { label: 'Cổng khách hàng', href: '/dashboard' },
        { label: t },
      ]}
      width="wide"
    >
      <PageToolbar title={t} subtitle="Đang tải…" />
      <div
        className="portal-route-skeleton"
        data-portal-skeleton="1"
        data-skeleton-href={href || ''}
        aria-busy="true"
        aria-live="polite"
      >
        <p className="portal-route-skeleton__status">Đang tải…</p>
        <VariantBody variant={v} />
      </div>
    </PortalPage>
  );
}

export function PortalRouteLoading({ href }: { href: string }) {
  return <PortalRouteSkeleton href={href} />;
}

import Link from 'next/link';
import { CpIngest } from '@/components/crm/cp/CpIngest';
import { CpMediaLibrary } from '@/components/crm/cp/CpMediaLibrary';
import { CpRightsCenter } from '@/components/crm/cp/CpRightsCenter';
import { dash } from '@/lib/crm/cp-format';

const MEDIA_TABS = [
  { id: 'library', label: 'Library', href: '/crm/creative-os/media' },
  { id: 'ingest', label: 'Ingest', href: '/crm/creative-os/media?tab=ingest' },
  { id: 'collections', label: 'Collections', href: '/crm/creative-os/media?tab=collections' },
  { id: 'rights', label: 'Rights', href: '/crm/creative-os/media?tab=rights' },
  { id: 'quality', label: 'Quality', href: '/crm/creative-os/media?tab=quality' },
] as const;

function EmptyMediaTab({ tab }: { tab: 'collections' | 'quality' }) {
  const title = tab === 'collections' ? 'Collections' : 'Duplicate & Quality';
  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / {title}</p>
          <h1>{title}</h1>
          <p className="cp-muted">Quản lý media theo dữ liệu hiện có.</p>
        </div>
      </header>
      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((item) => (
          <Link key={item.id} className={item.id === tab ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="cp-card">
        <p className="cp-muted">Chưa có dữ liệu</p>
        <p className="cp-empty">{dash(null)}</p>
      </section>
    </div>
  );
}

export default function CreativeOsMediaPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  if (searchParams.tab === 'ingest') return <CpIngest />;
  if (searchParams.tab === 'rights') return <CpRightsCenter />;
  if (searchParams.tab === 'collections') return <EmptyMediaTab tab="collections" />;
  if (searchParams.tab === 'quality') return <EmptyMediaTab tab="quality" />;
  return <CpMediaLibrary />;
}

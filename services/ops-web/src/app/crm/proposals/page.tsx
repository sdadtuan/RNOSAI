import { redirect } from 'next/navigation';
import { QtOverview } from '@/components/crm/qt/QtOverview';
import { qtOverviewRedirect, type QtSearchParams } from '@/lib/crm/qt-redirect';

export default function CrmProposalsPage({ searchParams }: { searchParams: QtSearchParams }) {
  const target = qtOverviewRedirect(searchParams);
  if (target) redirect(target);
  return <QtOverview />;
}

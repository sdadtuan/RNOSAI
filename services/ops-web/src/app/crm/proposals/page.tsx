import { redirect } from 'next/navigation';
import { QtPlaceholder } from '@/components/crm/qt/QtShell';
import { qtOverviewRedirect, type QtSearchParams } from '@/lib/crm/qt-redirect';

export default function CrmProposalsPage({ searchParams }: { searchParams: QtSearchParams }) {
  const target = qtOverviewRedirect(searchParams);
  if (target) redirect(target);
  return <QtPlaceholder title="Tổng quan" />;
}

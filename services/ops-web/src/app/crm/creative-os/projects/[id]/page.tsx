import { CpProjectTimeline } from '@/components/crm/cp/CpProjectTimeline';
import { CpProjectWorkspace } from '@/components/crm/cp/CpProjectWorkspace';

export default function CreativeOsProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; pane?: string };
}) {
  return searchParams.tab === 'timeline'
    ? <CpProjectTimeline projectId={params.id} />
    : <CpProjectWorkspace projectId={params.id} />;
}

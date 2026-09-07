import { CpOpsMonitor } from '@/components/crm/cp/CpOpsMonitor';

export default function CreativeOsOpsPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  return <CpOpsMonitor scope={searchParams.scope} title="Ops Monitor" />;
}

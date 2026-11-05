import { CpOpsMonitor } from '@/components/crm/cp/CpOpsMonitor';

export default function CreativeOsVideoOpsPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  return <CpOpsMonitor scope={searchParams.scope} title="Render Operations" />;
}

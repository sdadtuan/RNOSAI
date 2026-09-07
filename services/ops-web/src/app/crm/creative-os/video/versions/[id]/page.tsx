import { CpVersionDetail } from '@/components/crm/cp/CpVersionDetail';

export default function CreativeOsVideoVersionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { scope?: string };
}) {
  return <CpVersionDetail versionId={params.id} scope={searchParams.scope} />;
}

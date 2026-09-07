import { CpVideoStudio } from '@/components/crm/cp/CpVideoStudio';

export default function CreativeOsVideoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { scope?: string };
}) {
  return <CpVideoStudio videoId={params.id} scope={searchParams.scope} />;
}

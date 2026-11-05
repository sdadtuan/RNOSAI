import { CpVideoStudio } from '@/components/crm/cp/CpVideoStudio';

export default function CreativeOsVideoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { scope?: string; tab?: string };
}) {
  return <CpVideoStudio videoId={params.id} scope={searchParams.scope} tab={searchParams.tab} />;
}

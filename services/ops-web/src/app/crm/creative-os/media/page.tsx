import { CpCollections } from '@/components/crm/cp/CpCollections';
import { CpIngest } from '@/components/crm/cp/CpIngest';
import { CpMediaLibrary } from '@/components/crm/cp/CpMediaLibrary';
import { CpQuality } from '@/components/crm/cp/CpQuality';
import { CpRightsCenter } from '@/components/crm/cp/CpRightsCenter';

export default function CreativeOsMediaPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  if (searchParams.tab === 'ingest') return <CpIngest />;
  if (searchParams.tab === 'rights') return <CpRightsCenter />;
  if (searchParams.tab === 'collections') return <CpCollections />;
  if (searchParams.tab === 'quality') return <CpQuality />;
  return <CpMediaLibrary />;
}

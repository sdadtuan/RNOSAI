import {
  CpBrandEditor,
  type CpBrandTab,
} from '@/components/crm/cp/CpBrandEditor';

const BRAND_TABS: CpBrandTab[] = ['editor', 'rules', 'preview', 'history'];

export default function CreativeOsBrandKitDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; scope?: string };
}) {
  const activeTab = BRAND_TABS.includes(searchParams.tab as CpBrandTab)
    ? searchParams.tab as CpBrandTab
    : 'editor';

  return (
    <CpBrandEditor
      kitId={params.id}
      activeTab={activeTab}
      scope={searchParams.scope}
    />
  );
}

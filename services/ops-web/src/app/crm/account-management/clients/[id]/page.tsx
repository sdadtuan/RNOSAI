import { AmAccount360 } from '@/components/crm/am/AmAccount360';

export default function AmClientDetailPage({ params }: { params: { id: string } }) {
  return <AmAccount360 agencyClientId={params.id} />;
}

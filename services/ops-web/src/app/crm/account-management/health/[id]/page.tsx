import { AmHealthDetail } from '@/components/crm/am/AmHealthDetail';

export default function AmHealthDetailPage({ params }: { params: { id: string } }) {
  return <AmHealthDetail agencyClientId={params.id} />;
}

import { AmContractDetail } from '@/components/crm/am/AmContractDetail';

export default function AmContractDetailPage({ params }: { params: { id: string } }) {
  return <AmContractDetail contractId={params.id} />;
}

import { AmRenewalCase } from '@/components/crm/am/AmRenewalCase';

export default function AmRenewalDetailPage({ params }: { params: { id: string } }) {
  return <AmRenewalCase caseId={params.id} />;
}

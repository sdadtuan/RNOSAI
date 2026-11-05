import { AmOnboarding } from '@/components/crm/am/AmOnboarding';

export default function AmOnboardingDetailPage({ params }: { params: { id: string } }) {
  return <AmOnboarding caseId={params.id} />;
}

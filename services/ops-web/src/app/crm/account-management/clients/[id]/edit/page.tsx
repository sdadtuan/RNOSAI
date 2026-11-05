import { AmAccountForm } from '@/components/crm/am/AmAccountForm';

export default function AmClientEditPage({ params }: { params: { id: string } }) {
  return <AmAccountForm agencyClientId={params.id} />;
}

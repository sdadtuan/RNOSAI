import { redirect } from 'next/navigation';
import { QtPlaceholder } from '@/components/crm/qt/QtShell';

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value?.trim() ?? '';
}

export default function CrmProposalsPage({
  searchParams,
}: {
  searchParams: {
    id?: SearchValue;
    wizard?: SearchValue;
    lead_id?: SearchValue;
    customer_id?: SearchValue;
  };
}) {
  const id = first(searchParams.id);
  if (id) {
    redirect(`/crm/proposals/${encodeURIComponent(id)}`);
  }

  if (first(searchParams.wizard) === '1') {
    const params = new URLSearchParams();
    const leadId = first(searchParams.lead_id);
    const customerId = first(searchParams.customer_id);
    if (leadId) params.set('lead_id', leadId);
    if (customerId) params.set('customer_id', customerId);
    const query = params.toString();
    redirect(query ? `/crm/proposals/new?${query}` : '/crm/proposals/new');
  }

  return <QtPlaceholder title="Tổng quan" />;
}

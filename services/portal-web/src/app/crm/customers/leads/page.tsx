import { redirect } from 'next/navigation';

export default function PortalCustomerLeadsRedirectPage() {
  redirect('/crm/customers?source=lead');
}

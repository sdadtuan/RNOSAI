import { redirect } from 'next/navigation';

export default function PortalCustomerMessagesRedirectPage() {
  redirect('/crm/customers?source=message');
}

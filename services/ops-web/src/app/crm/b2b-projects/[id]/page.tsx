import { redirect } from 'next/navigation';

export default function B2bProjectDetailRedirectPage() {
  redirect('/crm/delivery-projects?capability=lead_ingest');
}

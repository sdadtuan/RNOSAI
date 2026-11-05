import { redirect } from 'next/navigation';

export default function B2bProjectsRedirectPage() {
  redirect('/crm/delivery-projects?capability=lead_ingest');
}

import { redirect } from 'next/navigation';

export default function RevenueOpsLeadsAliasPage() {
  redirect('/crm/leads?revops=1');
}

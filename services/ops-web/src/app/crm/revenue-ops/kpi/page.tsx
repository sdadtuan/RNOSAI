import { redirect } from 'next/navigation';

export default function RevenueOpsKpiAliasPage() {
  redirect('/crm/kpi-hub/sales?revops=1');
}

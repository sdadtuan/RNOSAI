import { IntakeContent } from './IntakeContent';

type CrmIntakePageProps = {
  searchParams?: {
    lead_id?: string;
    lifecycle_id?: string;
  };
};

export default function CrmIntakePage({ searchParams }: CrmIntakePageProps) {
  const leadId = Number(searchParams?.lead_id ?? 0);
  const lifecycleId = Number(searchParams?.lifecycle_id ?? 0);

  return <IntakeContent initialLeadId={leadId} initialLifecycleId={lifecycleId} />;
}

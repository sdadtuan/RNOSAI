import { IntakeContent } from './IntakeContent';

type CrmIntakePageProps = {
  searchParams?: {
    lead_id?: string;
    lifecycle_id?: string;
    session_id?: string;
    open?: string;
  };
};

export default function CrmIntakePage({ searchParams }: CrmIntakePageProps) {
  const leadId = Number(searchParams?.lead_id ?? 0);
  const lifecycleId = Number(searchParams?.lifecycle_id ?? 0);
  const sessionId = Number(searchParams?.session_id ?? 0);
  const openBant = searchParams?.open === 'bant';

  return (
    <IntakeContent
      initialLeadId={leadId}
      initialLifecycleId={lifecycleId}
      initialSessionId={sessionId}
      initialOpenBant={openBant}
    />
  );
}

export const dynamic = 'force-dynamic';

import { leadFlowKindLabel, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';

type LeadFlowKindTagProps = {
  kind: LeadFlowKind | string | null | undefined;
  compact?: boolean;
};

export function LeadFlowKindTag({ kind, compact = false }: LeadFlowKindTagProps) {
  if (kind !== 'spa_operational' && kind !== 'b2b_prospect') return null;
  return (
    <span
      className={`lead-kind-tag lead-kind-tag--${kind === 'spa_operational' ? 'spa' : 'b2b'}`}
      title={leadFlowKindLabel(kind)}
    >
      {compact ? (kind === 'spa_operational' ? 'CSKH' : 'B2B') : leadFlowKindLabel(kind)}
    </span>
  );
}

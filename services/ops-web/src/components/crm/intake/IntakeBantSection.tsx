'use client';

import { IntakeBantTotalBar } from '@/components/crm/intake/IntakeBantTotalBar';
import { computeBantTotal, getDecisionMismatchMessage } from '@/lib/crm/intake-bant';

interface Props {
  bant: Record<string, number>;
  decision: string;
  onOpenBant: () => void;
}

export function IntakeBantSection({ bant, decision, onOpenBant }: Props) {
  const liveTotal = computeBantTotal(bant);
  const mismatch = getDecisionMismatchMessage(decision, liveTotal);

  return (
    <div className="intake-bant-section__body stack-gap">
      <IntakeBantTotalBar total={liveTotal} />

      <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenBant}>
        Mở checklist BANT
      </button>
      <p className="muted">Điểm từ checklist BANT trên Deal Bar.</p>

      {mismatch ? (
        <p className="intake-bant-decision-warn" role="status">
          ⚠ {mismatch}
        </p>
      ) : null}
    </div>
  );
}

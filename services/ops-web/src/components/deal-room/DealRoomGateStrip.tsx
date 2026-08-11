'use client';

import type { DealRoomGateChip } from '@/lib/api';

const STATUS_CLASS: Record<DealRoomGateChip['status'], string> = {
  ok: 'deal-room-gate--ok',
  warn: 'deal-room-gate--warn',
  block: 'deal-room-gate--block',
  pending: 'deal-room-gate--pending',
};

const STATUS_ICON: Record<DealRoomGateChip['status'], string> = {
  ok: '✓',
  warn: '!',
  block: '✕',
  pending: '○',
};

interface Props {
  gates: {
    g0_b2: DealRoomGateChip;
    g1_consult: DealRoomGateChip;
    g4_r5: DealRoomGateChip;
    g5_proposal: DealRoomGateChip;
    g6_accept: DealRoomGateChip;
  };
}

export function DealRoomGateStrip({ gates }: Props) {
  const chips = [gates.g0_b2, gates.g1_consult, gates.g4_r5, gates.g5_proposal, gates.g6_accept];

  return (
    <div className="deal-room-gate-strip" role="list" aria-label="Deal gates">
      {chips.map((gate) => (
        <div
          key={gate.key}
          className={`deal-room-gate ${STATUS_CLASS[gate.status]}`}
          role="listitem"
          title={gate.message}
        >
          <span className="deal-room-gate__icon" aria-hidden>
            {STATUS_ICON[gate.status]}
          </span>
          <span className="deal-room-gate__label">{gate.label}</span>
        </div>
      ))}
    </div>
  );
}

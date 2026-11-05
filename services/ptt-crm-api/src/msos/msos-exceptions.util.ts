export type ExceptionSourceInput = {
  calendarConflicts: { placement_id: string; date: string }[];
  liveUnofficial: { media_line_id: string; display_code: string }[];
  makeGoodUnreserved: { media_line_id: string; display_code: string }[];
  trafficRejected: { media_line_id: string; display_code: string }[];
};

export type DerivedException = {
  priority: 'P0' | 'P1';
  kind: string;
  placement_id?: string | null;
  media_line_id?: string | null;
  title: string;
  evidence_text: string;
};

export function rebuildExceptions(input: ExceptionSourceInput): DerivedException[] {
  const out: DerivedException[] = [];

  for (const conflict of input.calendarConflicts) {
    out.push({
      priority: 'P0',
      kind: 'capacity_conflict',
      placement_id: conflict.placement_id,
      title: 'Capacity calendar conflict',
      evidence_text: `Conflict on ${conflict.date}`,
    });
  }

  for (const line of input.liveUnofficial) {
    out.push({
      priority: 'P0',
      kind: 'evidence_unofficial',
      media_line_id: line.media_line_id,
      title: 'Evidence pack not official',
      evidence_text: `Line ${line.display_code} is live without official evidence pack`,
    });
  }

  for (const mg of input.makeGoodUnreserved) {
    out.push({
      priority: 'P1',
      kind: 'make_good_unreserved',
      media_line_id: mg.media_line_id,
      title: 'Make-good capacity not reserved',
      evidence_text: `Make-good ${mg.display_code} has capacity_reserved=false`,
    });
  }

  for (const traffic of input.trafficRejected) {
    out.push({
      priority: 'P1',
      kind: 'traffic_rejected',
      media_line_id: traffic.media_line_id,
      title: 'Traffic pack rejected',
      evidence_text: `Traffic for line ${traffic.display_code} was rejected`,
    });
  }

  return out;
}

export function computeScorecard(input: {
  delivery_bps: number;
  discrepancy_bps: number;
  safety_incidents: number;
}): number {
  const deliveryScore = Math.round(input.delivery_bps / 100);
  const discrepancyPenalty = Math.min(30, Math.round(input.discrepancy_bps / 50));
  const safetyPenalty = input.safety_incidents * 10;
  return Math.max(0, Math.min(100, deliveryScore - discrepancyPenalty - safetyPenalty));
}

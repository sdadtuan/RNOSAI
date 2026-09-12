export type GateResult = {
  id: string;
  pass: boolean;
  level: 'pass' | 'fail' | 'warning';
  detail: string;
};

export function canIssueIo(input: {
  rateStatus: string;
  clientOk: boolean;
  hasSafetySnapshot: boolean;
  hardOrValidSoft: boolean;
}): { pass: boolean; gate: 'GT-P01'; fail?: string } {
  if (input.rateStatus !== 'published') {
    return { pass: false, gate: 'GT-P01', fail: 'rate_not_published' };
  }
  if (!input.clientOk) {
    return { pass: false, gate: 'GT-P01', fail: 'client_not_found' };
  }
  if (!input.hasSafetySnapshot) {
    return { pass: false, gate: 'GT-P01', fail: 'safety_snapshot_required' };
  }
  if (!input.hardOrValidSoft) {
    return { pass: false, gate: 'GT-P01', fail: 'reserve_required' };
  }
  return { pass: true, gate: 'GT-P01' };
}

export function evaluateLiveGates(input: {
  ioIssued: boolean;
  ratePublished: boolean;
  reserveOk: boolean;
  clientOk: boolean;
  safetyLocked: boolean;
  trafficReady: boolean;
  partnerConfirmed: boolean;
  p03Override: boolean;
  trackingOwner: boolean;
}): { canLive: boolean; gates: GateResult[] } {
  const gtP01Pass =
    input.ioIssued &&
    input.ratePublished &&
    input.reserveOk &&
    input.clientOk &&
    input.safetyLocked;
  const gtP02Pass = input.trafficReady;
  const gtP03Pass = input.partnerConfirmed || input.p03Override;
  const gt03Pass = input.trackingOwner;

  const gates: GateResult[] = [
    {
      id: 'GT-P01',
      pass: gtP01Pass,
      level: gtP01Pass ? 'pass' : 'fail',
      detail: gtP01Pass ? 'IO issued with valid reserve and safety lock' : 'IO / rate / reserve / safety incomplete',
    },
    {
      id: 'GT-P02',
      pass: gtP02Pass,
      level: gtP02Pass ? 'pass' : 'fail',
      detail: gtP02Pass ? 'Traffic pack approved' : 'Traffic pack not ready',
    },
    {
      id: 'GT-P03',
      pass: gtP03Pass,
      level: gtP03Pass ? 'pass' : input.p03Override ? 'warning' : 'fail',
      detail: gtP03Pass
        ? input.p03Override
          ? 'Partner confirm waived via P03 override'
          : 'Partner confirmed'
        : 'Partner confirmation pending',
    },
    {
      id: 'GT-03',
      pass: gt03Pass,
      level: gt03Pass ? 'pass' : 'fail',
      detail: gt03Pass ? 'Tracking owner assigned' : 'Tracking owner required',
    },
  ];

  const canLive = gtP01Pass && gtP02Pass && gtP03Pass && gt03Pass;
  return { canLive, gates };
}

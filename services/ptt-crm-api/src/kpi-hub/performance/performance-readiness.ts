import type { KpiDirection } from './performance-score';

export type GateId = 'definition' | 'owner' | 'band' | 'source' | 'visibility';
export type GateStatus = 'pass' | 'pending' | 'fail';

export function validateTargetBand(input: {
  direction: KpiDirection | string;
  min: number | null;
  target: number;
  stretch: number | null;
}): { ok: boolean; error?: 'band_invalid' } {
  if (!Number.isFinite(input.target)) return { ok: false, error: 'band_invalid' };
  if (input.min == null && input.stretch == null) return { ok: true };
  if (input.direction === 'lower') {
    const stretchOk = input.stretch == null || input.stretch <= (input.min ?? input.target);
    const minOk = input.min == null || input.min <= input.target;
    return stretchOk && minOk ? { ok: true } : { ok: false, error: 'band_invalid' };
  }
  const minOk = input.min == null || input.min <= input.target;
  const stretchOk = input.stretch == null || input.target <= input.stretch;
  return minOk && stretchOk ? { ok: true } : { ok: false, error: 'band_invalid' };
}

export function evaluateReadiness(i: {
  definition_active: boolean;
  owner_active: boolean;
  band_valid: boolean;
  has_measurement_plan: boolean;
  auto_tracked: boolean;
  client_visible: boolean;
  has_disclaimer: boolean;
}): { gates: Array<{ id: GateId; status: GateStatus; detail: string }>; can_activate: boolean } {
  const gates: Array<{ id: GateId; status: GateStatus; detail: string }> = [
    { id: 'definition', status: i.definition_active ? 'pass' : 'fail', detail: 'Dictionary Active' },
    { id: 'owner', status: i.owner_active ? 'pass' : 'fail', detail: 'Owner active' },
    { id: 'band', status: i.band_valid ? 'pass' : 'fail', detail: 'Direction / band' },
    {
      id: 'source',
      status: !i.auto_tracked || i.has_measurement_plan ? 'pass' : 'pending',
      detail: 'Measurement Plan',
    },
    {
      id: 'visibility',
      status: !i.client_visible || i.has_disclaimer ? 'pass' : 'fail',
      detail: 'Client disclaimer',
    },
  ];
  return { gates, can_activate: gates.every((g) => g.status === 'pass') };
}

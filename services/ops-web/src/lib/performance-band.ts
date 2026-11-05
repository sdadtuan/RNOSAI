/** Mirrors backend validateTargetBand (lower: stretch ≤ min ≤ target). */
export function isTargetBandValid(input: {
  direction: string;
  min: number;
  target: number;
  stretch: number;
}): boolean {
  if (!Number.isFinite(input.target) || input.target <= 0) return false;
  if (!input.min && !input.stretch) return true;
  if (input.direction === 'lower') {
    const stretchOk = !input.stretch || input.stretch <= (input.min || input.target);
    const minOk = !input.min || input.min <= input.target;
    return stretchOk && minOk;
  }
  const minOk = !input.min || input.min <= input.target;
  const stretchOk = !input.stretch || input.target <= input.stretch;
  return minOk && stretchOk;
}

export function evaluateAssignmentReadiness(input: {
  definition_active: boolean;
  owner_active: boolean;
  band_valid: boolean;
  has_measurement_plan: boolean;
  auto_tracked: boolean;
  client_visible: boolean;
  has_disclaimer: boolean;
}) {
  const gates = [
    { id: 'definition', status: input.definition_active ? 'pass' : 'fail', detail: 'Definition Active' },
    { id: 'owner', status: input.owner_active ? 'pass' : 'fail', detail: 'Owner active' },
    { id: 'band', status: input.band_valid ? 'pass' : 'fail', detail: 'Direction / band' },
    {
      id: 'source',
      status: !input.auto_tracked || input.has_measurement_plan ? 'pass' : 'pending',
      detail: 'Measurement Plan',
    },
    {
      id: 'visibility',
      status: !input.client_visible || input.has_disclaimer ? 'pass' : 'fail',
      detail: 'Client disclaimer',
    },
  ] as Array<{ id: string; status: string; detail: string }>;
  return { gates, can_activate: gates.every((g) => g.status === 'pass') };
}

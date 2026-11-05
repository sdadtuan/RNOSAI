export type CommandPersona = 'executive' | 'marketing' | 'sales';

export const EXEC_TILE_CODES = ['SAL_008', 'SAL_005', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007'] as const;
export const MKT_TILE_CODES = ['MKT_004', 'MKT_001', 'MKT_002', 'MKT_006', 'MKT_008', 'MKT_009'] as const;
export const SALES_TILE_CODES = ['SAL_005', 'SAL_005W', 'SAL_001', 'SAL_003', 'SAL_007', 'SAL_008'] as const;

const VALID_PERSONAS: CommandPersona[] = ['executive', 'marketing', 'sales'];

export function isCommandPersona(value: string): value is CommandPersona {
  return (VALID_PERSONAS as string[]).includes(value);
}

export function tileCodesFor(persona: CommandPersona): readonly string[] {
  switch (persona) {
    case 'executive':
      return EXEC_TILE_CODES;
    case 'marketing':
      return MKT_TILE_CODES;
    case 'sales':
      return SALES_TILE_CODES;
  }
}

export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function applyDataIssuePrecedence(status: string, freshness: string, dqCritical: boolean): string {
  if (freshness === 'FAILED' || dqCritical) return 'DATA_ISSUE';
  return status;
}

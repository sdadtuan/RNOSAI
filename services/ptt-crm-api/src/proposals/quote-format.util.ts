export function kpiOrNull(value: number | null | undefined): number | null {
  return value ?? null;
}

export function dash<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

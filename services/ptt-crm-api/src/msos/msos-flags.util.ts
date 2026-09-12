export function parseMediaOsFlag(raw: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((raw ?? '0').trim().toLowerCase());
}

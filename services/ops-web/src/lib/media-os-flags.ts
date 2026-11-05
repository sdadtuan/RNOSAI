export function isMediaOsFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MEDIA_OS ?? '0').trim().toLowerCase(),
  );
}

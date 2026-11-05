export function researchAiTokenHint(secret: string): string {
  const raw = String(secret ?? '');
  if (!raw) return '…';
  const tail = raw.slice(-4);
  return `…${tail}`;
}

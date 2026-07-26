/** RNOS-06 — client feature gate for AI Copilot (ops-web). */

export function aiCopilotEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED ?? '0').trim().toLowerCase() !== '0';
}

export function aiCopilotPilotUserIds(): string[] {
  const raw = (process.env.NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS ?? '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** When pilot list empty, all staff with cap may use copilot (matches Nest default). */
export function isAiPilotUser(staffId: string | undefined | null): boolean {
  if (!staffId) return false;
  const cohort = aiCopilotPilotUserIds();
  if (cohort.length === 0) return true;
  return cohort.includes(staffId);
}

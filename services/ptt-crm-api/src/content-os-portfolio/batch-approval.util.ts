import { BadRequestException, ConflictException } from '@nestjs/common';

export const CMKT_BATCH_APPROVE_MAX = 20;

export function parseBatchItemIds(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const value of list) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) {
    throw new BadRequestException({ error: 'empty_item_ids' });
  }
  if (ids.length > CMKT_BATCH_APPROVE_MAX) {
    throw new BadRequestException({ error: 'batch_limit', max: CMKT_BATCH_APPROVE_MAX });
  }
  return ids;
}

export function assertSameApproveStep(statuses: string[], step?: string): string {
  const unique = [...new Set(statuses.map((status) => String(status ?? '').trim()).filter(Boolean))];
  const shared = unique[0] ?? '';
  if (unique.length !== 1 || (step && step !== shared)) {
    throw new ConflictException({ error: 'mixed_step', statuses: unique });
  }
  return shared;
}

export function isCmktSodEnabled(
  env: NodeJS.Dict<string> = process.env,
  tenantFlag?: boolean,
): boolean {
  if (env.CMKT_SOD_ENABLED === '1') return true;
  return tenantFlag === true;
}

function normEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function actorIsItemCreator(
  actorEmail: string,
  sources: {
    created_by?: string | null;
    first_version_author?: string | null;
    package_created_by?: string | null;
  },
): boolean {
  const actor = normEmail(actorEmail);
  if (!actor) return false;
  return [sources.created_by, sources.first_version_author, sources.package_created_by]
    .map(normEmail)
    .some((email) => email.length > 0 && email === actor);
}

export function parseDelegateUntil(raw: unknown): string {
  const text = String(raw ?? '').trim();
  const at = new Date(text);
  if (!text || !Number.isFinite(at.getTime())) {
    throw new BadRequestException({ error: 'invalid_delegate_until' });
  }
  return at.toISOString();
}

export function isDelegateExpired(
  delegateUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (delegateUntil == null || String(delegateUntil).trim() === '') return false;
  const until = new Date(delegateUntil);
  if (!Number.isFinite(until.getTime())) return false;
  return until.getTime() <= now.getTime();
}

export function packageDelegateUntil(pkg: {
  delegate_until?: string | null;
  snapshot_json?: { delegate_until?: unknown } | null;
}): string | null {
  const col = pkg.delegate_until;
  if (col != null && String(col).trim()) return String(col);
  const snap = pkg.snapshot_json?.delegate_until;
  return snap != null && String(snap).trim() ? String(snap) : null;
}

export function packageDelegateTo(pkg: {
  delegate_to?: string | null;
  snapshot_json?: { delegate_to?: unknown } | null;
}): string | null {
  const snap = pkg.snapshot_json?.delegate_to;
  if (snap != null && String(snap).trim()) return String(snap);
  return pkg.delegate_to != null && String(pkg.delegate_to).trim() ? String(pkg.delegate_to) : null;
}

export function actionErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'getResponse' in err) {
    const getResponse = (err as { getResponse?: () => unknown }).getResponse;
    if (typeof getResponse === 'function') {
      const res = getResponse.call(err);
      if (typeof res === 'object' && res && 'error' in res) {
        return String((res as { error: unknown }).error);
      }
    }
  }
  return err instanceof Error ? err.message : 'approve_failed';
}

export function canApproveAsDelegate(
  delegateUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (delegateUntil == null || String(delegateUntil).trim() === '') return false;
  const until = new Date(delegateUntil);
  if (!Number.isFinite(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

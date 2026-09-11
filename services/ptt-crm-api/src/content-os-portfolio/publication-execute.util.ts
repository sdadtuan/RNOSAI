import { BadRequestException } from '@nestjs/common';

export function assertHumanConfirm(confirm: unknown): asserts confirm is true {
  if (confirm !== true) {
    throw new BadRequestException({ error: 'human_confirm_required' });
  }
}

export function assertExecuteGate(status: 'Pass' | 'Warning' | 'Blocked'): void {
  if (status === 'Blocked') {
    throw new BadRequestException({ error: 'publish_gate_blocked' });
  }
}

export type ExecuteBody = {
  item_id: number;
  channel_account_id: number;
  snapshot_id: string;
  confirm: true;
  client_request_id: string;
};

export type ExecuteAccepted = { queued: true; client_request_id: string; execute_id: number };

export function lockedSnapshotId(item: {
  current_version_id?: unknown;
  version_id?: unknown;
}): string {
  return String(item.current_version_id ?? item.version_id ?? '');
}

export function lockedItemCopy(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  if (typeof item.copy === 'string') return item.copy;
  const body = item.body_json ?? item.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    if (typeof rec.copy === 'string') return rec.copy;
    if (typeof rec.markdown === 'string') return rec.markdown;
    const idx = Number(item.selected_variant_idx ?? 0);
    if (Array.isArray(rec.variants) && typeof rec.variants[idx] === 'string') {
      return rec.variants[idx];
    }
  }
  return '';
}

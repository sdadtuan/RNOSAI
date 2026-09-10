import { redactPortalText } from '../portal-mkt-ai/portal-mkt-ai-summary.util';
import type { CmktApprovalPackageRow, CmktItemRow } from '../content-marketing/content-marketing.types';
import type {
  CmktPortalApprovalPackage,
  CmktPortalSummaryItem,
} from './portal-content-marketing.types';

export function buildStaffContentOsUrl(opsWebBase: string, lifecycleId: number): string {
  const base = opsWebBase.replace(/\/$/, '');
  return `${base}/crm/service-delivery/${lifecycleId}?tab=content-os`;
}

export function isPortalInternalKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower === 'internal_note' || lower === 'hidden_rule') return true;
  return lower.includes('prompt') || lower.includes('cost');
}

export function stripPortalInternalFields<T>(value: T): T {
  return stripPortalValue(value) as T;
}

function stripPortalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPortalValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isPortalInternalKey(key)) continue;
      out[key] = stripPortalValue(nested);
    }
    return out;
  }
  return value;
}

export function toPortalApprovalPackage(row: CmktApprovalPackageRow): CmktPortalApprovalPackage {
  return stripPortalInternalFields({
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    snapshot_json: (row.snapshot_json ?? {}) as Record<string, unknown>,
  });
}

export function toPortalSummaryItem(
  row: CmktItemRow,
  approvalPackage?: CmktApprovalPackageRow | null,
): CmktPortalSummaryItem {
  const item: CmktPortalSummaryItem = {
    id: row.id,
    title: redactPortalText(row.title),
    channel: row.channel,
    format: row.format,
    status: row.status,
    updated_at: row.updated_at,
  };
  if (approvalPackage) {
    item.approval_package = toPortalApprovalPackage(approvalPackage);
  }
  return stripPortalInternalFields(item);
}

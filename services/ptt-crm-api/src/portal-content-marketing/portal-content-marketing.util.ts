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

const PUBLIC_RIGHTS_KEYS = [
  'asset_ref',
  'license_type',
  'channels',
  'territory',
  'expiry_at',
  'status',
] as const;

function collectMediaUrls(value: unknown, urls: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectMediaUrls(entry, urls);
    return urls;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'url' || key === 'poster_url') && typeof nested === 'string' && nested.trim()) {
        urls.push(nested);
      } else {
        collectMediaUrls(nested, urls);
      }
    }
  }
  return urls;
}

function slimPublicRights(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  const src = row as Record<string, unknown>;
  const slim: Record<string, unknown> = {};
  for (const key of PUBLIC_RIGHTS_KEYS) {
    if (key in src) slim[key] = src[key];
  }
  return slim;
}

export function allowlistPortalSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const body = snapshot.body_json;
  if (body && typeof body === 'object') {
    const markdown = (body as Record<string, unknown>).markdown;
    if (markdown != null) out.body_json = { markdown };
  }
  if (snapshot.disclaimer != null) out.disclaimer = snapshot.disclaimer;
  if (Array.isArray(snapshot.rights)) {
    out.rights = snapshot.rights.map(slimPublicRights);
  }
  const urls = collectMediaUrls(snapshot.media);
  if (urls.length) out.media = { urls };
  return stripPortalInternalFields(out);
}

export function toPortalApprovalPackage(row: CmktApprovalPackageRow): CmktPortalApprovalPackage {
  return stripPortalInternalFields({
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    snapshot_json: allowlistPortalSnapshot((row.snapshot_json ?? {}) as Record<string, unknown>),
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

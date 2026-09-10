import type { ContentOsItem } from '@/lib/content-os-api';
import type { PublishGateInput } from './cmkte-publish-gate';

export function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function isBlankRecord(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

const INTERNAL_OK = new Set(['approved_internal', 'pending_client', 'client_approved', 'scheduled', 'published']);
const CLIENT_OK = new Set(['client_approved', 'scheduled', 'published']);

export function publishGateFlagsFromItem(item: ContentOsItem | null): PublishGateInput {
  const brief = item?.brief_json ?? {};
  const dest = String(brief.destination_url ?? brief.url ?? item?.published_url ?? '').trim();
  const status = item?.status ?? '';
  return {
    briefReady: !isBlankRecord(item?.brief_json),
    internalApproved: INTERNAL_OK.has(status),
    legalRequired: false,
    legalApproved: false,
    clientApproved: CLIENT_OK.has(status),
    urlOk: /^https?:\/\//i.test(dest),
  };
}

export function canMarkPublished(
  gateStatus: 'Pass' | 'Warning' | 'Blocked',
  itemStatus?: string,
): boolean {
  return gateStatus === 'Pass' && itemStatus !== 'published';
}

export function rejectCommentValid(comment: string): boolean {
  return comment.trim().length >= 10;
}

export function itemMediaUrls(item: ContentOsItem | null | undefined): string[] {
  if (!item) return [];
  const fromProd = Array.isArray(item.production_json?.asset_urls)
    ? item.production_json.asset_urls.filter((url): url is string => typeof url === 'string' && url.trim() !== '')
    : [];
  const media = [
    ...(item.media_json?.ai_assets ?? []),
    ...(item.media_json?.carousel_slides ?? []),
    item.media_json?.video_short,
  ]
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset?.url))
    .map((asset) => asset.url);
  return [...fromProd, ...media];
}

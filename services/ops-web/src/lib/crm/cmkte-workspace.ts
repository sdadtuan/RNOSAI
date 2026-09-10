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

function generatePathBriefReady(brief: Record<string, unknown> | undefined): boolean {
  const audience = !isBlankRecord(brief?.audience) || !isBlankRecord(brief?.persona);
  const goal = !isBlankRecord(brief?.goal) || !isBlankRecord(brief?.objective);
  return audience && goal;
}

export function publishGateFlagsFromItem(item: ContentOsItem | null): PublishGateInput {
  const brief = item?.brief_json ?? {};
  const dest = String(brief.destination_url ?? brief.url ?? item?.published_url ?? '').trim();
  const status = item?.status ?? '';
  const server = item?.publish_gate;
  const briefReady =
    typeof server?.briefReady === 'boolean'
      ? server.briefReady
      : typeof item?.brief_ready === 'boolean'
        ? item.brief_ready
        : generatePathBriefReady(brief);
  const urlOk = typeof server?.urlOk === 'boolean' ? server.urlOk : dest ? /^https?:\/\//i.test(dest) : true;
  const rightsValid = server?.rightsValid ?? item?.rights_valid;
  const paidExpiryWarning = server?.paidExpiryWarning ?? item?.paid_expiry_warning;
  return {
    briefReady,
    internalApproved:
      typeof server?.internalApproved === 'boolean' ? server.internalApproved : INTERNAL_OK.has(status),
    legalRequired: server?.legalRequired ?? false,
    legalApproved: server?.legalApproved ?? false,
    clientApproved: typeof server?.clientApproved === 'boolean' ? server.clientApproved : CLIENT_OK.has(status),
    urlOk,
    ...(rightsValid === false ? { rightsValid: false } : {}),
    ...(paidExpiryWarning ? { paidExpiryWarning: true } : {}),
  };
}

export function canMarkPublished(
  gateStatus: 'Pass' | 'Warning' | 'Blocked',
  itemStatus?: string,
): boolean {
  return gateStatus === 'Pass' && itemStatus !== 'published';
}

export type PublicationCollision = { item_id: number; at: string };

export function firstCalendarCollision(
  slots: Array<{ collision?: PublicationCollision | null }>,
  lastUpsert?: { collision?: PublicationCollision | null } | null,
): PublicationCollision | null {
  return lastUpsert?.collision ?? slots.find((slot) => slot.collision)?.collision ?? null;
}

export function calendarCollisionNotice(collision: PublicationCollision | null | undefined): string | null {
  if (!collision) return null;
  return `Cảnh báo trùng lịch xuất bản với item ${collision.item_id} lúc ${collision.at}. Không chặn đánh dấu published.`;
}

export function rejectCommentValid(comment: string): boolean {
  return comment.trim().length >= 10;
}

export const DEFAULT_CLAIM_LEXEMES = ['cam kết sinh lời', 'giá rẻ', 'số 1'] as const;

export function matchClaimLexemes(
  text: string,
  lexemes: readonly string[] = DEFAULT_CLAIM_LEXEMES,
): string[] {
  const hay = String(text ?? '').toLowerCase();
  return lexemes.filter((lexeme) => hay.includes(lexeme.toLowerCase()));
}

export function itemClaimHits(item: ContentOsItem | null | undefined): string[] {
  if (item?.claim_hits?.length) return item.claim_hits;
  const restricted = item?.brief_json?.restricted;
  const restrictedText = Array.isArray(restricted)
    ? restricted.map((entry) => String(entry ?? '')).join(' ')
    : String(restricted ?? '');
  const copy = [item?.body_json?.markdown, item?.body_json?.html, ...(item?.body_json?.variants ?? [])]
    .filter(Boolean)
    .join(' ');
  return matchClaimLexemes(`${restrictedText}\n${copy}`);
}

export type ClaimHighlightSegment = { text: string; hit: boolean };

export function claimHighlightSegments(
  text: string,
  hits: readonly string[],
): ClaimHighlightSegment[] {
  const source = String(text ?? '');
  if (!source || !hits.length) return source ? [{ text: source, hit: false }] : [];
  const pattern = hits
    .map((hit) => hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)
    .join('|');
  if (!pattern) return [{ text: source, hit: false }];
  const re = new RegExp(pattern, 'gi');
  const segments: ClaimHighlightSegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: source.slice(cursor, start), hit: false });
    segments.push({ text: match[0], hit: true });
    cursor = start + match[0].length;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), hit: false });
  return segments;
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

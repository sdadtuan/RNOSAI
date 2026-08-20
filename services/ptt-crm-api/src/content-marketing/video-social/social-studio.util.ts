import type { CmktMediaJson } from '../content-marketing.types';

export type CmktVideoStudio = 'social' | 'cinematic';

const PACK_MAX_SEC: Record<string, number> = {
  reels: 60,
  shorts: 60,
  feed_square: 45,
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function rawVoDurationSec(text: string): number {
  return Math.round(countWords(text) / 2.5);
}

export function estimateVoDurationSec(text: string): number {
  const raw = rawVoDurationSec(text);
  return Math.min(60, raw);
}

export function assertScriptFitsPack(text: string, packId: string): void {
  const maxSec = PACK_MAX_SEC[packId];
  if (maxSec == null) {
    return;
  }
  if (rawVoDurationSec(text) > maxSec) {
    throw new Error('script_too_long');
  }
}

export function lockVideoStudio(
  media: CmktMediaJson,
  studio: CmktVideoStudio,
): CmktMediaJson {
  return {
    ...media,
    video_studio: studio,
    studio_locked_at: new Date().toISOString(),
  };
}

export function assertStudioWritable(
  media: CmktMediaJson,
  next: CmktVideoStudio,
): void {
  if (media.studio_locked_at && media.video_studio && next !== media.video_studio) {
    throw new Error('studio_locked');
  }
}

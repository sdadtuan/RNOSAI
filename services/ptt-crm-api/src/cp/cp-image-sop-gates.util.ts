import { HttpException } from '@nestjs/common';
import type { ImgIntent } from './cp-image-sop.types';

export function assertSelectBeforeRefine(winnerAssetId: string | null | undefined): void {
  if (!winnerAssetId) {
    imgGateThrow(409, { error: 'stage_skip_forbidden', gate: 'GT-I11' });
  }
}

export function assertPackBeforeG3(
  formatPack: Record<string, unknown> | null | undefined,
  requiredRatios: string[] = ['1:1', '4:5', '9:16', '16:9'],
): void {
  if (!formatPack || typeof formatPack !== 'object') {
    imgGateThrow(422, { error: 'format_pack_incomplete', gate: 'GT-I10' });
  }
  const missing = requiredRatios.filter((ratio) => {
    const value = formatPack[ratio];
    return value == null || String(value).trim() === '';
  });
  if (missing.length > 0) {
    imgGateThrow(422, { error: 'format_pack_incomplete', gate: 'GT-I10', missing_ratios: missing });
  }
}

export function assertOfficialLockup(input: {
  intent: ImgIntent;
  overlayLockup: boolean;
  waiver: boolean;
}): void {
  if (input.intent !== 'text_cta') return;
  if (input.waiver) return;
  if (!input.overlayLockup) {
    imgGateThrow(422, { error: 'official_lockup_required', gate: 'GT-I09' });
  }
}

export function assertG1Passed(g1At: string | null | undefined): void {
  if (!g1At) {
    imgGateThrow(409, { error: 'g1_required', gate: 'GT-I02' });
  }
}

function imgGateThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}

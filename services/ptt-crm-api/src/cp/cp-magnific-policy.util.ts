import { HttpException } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';

export const MAGNIFIC_PILOT_CAPABILITIES = [
  'account_balance',
  'images_generate',
  'images_upscale',
  'images_remove_background',
  'images_crop',
  'images_resize',
  'video_generate',
  'creation_status',
  'creations_wait',
  'creations_get',
] as const;

export type MagnificPilotCapability = (typeof MAGNIFIC_PILOT_CAPABILITIES)[number];

const PILOT_SET = new Set<string>(MAGNIFIC_PILOT_CAPABILITIES);

export function mapMagnificTool(
  capability: string,
  discoveredNames: string[],
): string {
  const key = String(capability ?? '').trim();
  if (!PILOT_SET.has(key)) {
    cpThrow(409, { error: 'mcp_tool_unavailable' });
  }
  const wanted = normalizeToolName(key);
  const found = discoveredNames.find((name) => {
    const normalized = normalizeToolName(name);
    return normalized === wanted || normalized.endsWith(wanted);
  });
  if (!found) cpThrow(409, { error: 'mcp_tool_unavailable' });
  return found;
}

export function assertMagnificAllowed(input: {
  provider: 'magnific_mcp' | 'magnific_rest';
  flags: ReturnType<typeof readAiOpsFlags>;
  classification?: string | null;
  externalProhibited?: boolean;
}): void {
  const enabled =
    input.provider === 'magnific_mcp'
      ? input.flags.magnificMcp
      : input.flags.magnificRest;
  if (!enabled) {
    cpThrow(409, { error: 'magnific_disabled', gate: 'GT-A03' });
  }
  const classification = String(input.classification ?? '').trim().toUpperCase();
  if (classification === 'RESTRICTED' || input.externalProhibited === true) {
    cpThrow(409, { error: 'external_processing_prohibited', gate: 'GT-M05' });
  }
}

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().replace(/[._-]/g, '');
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}

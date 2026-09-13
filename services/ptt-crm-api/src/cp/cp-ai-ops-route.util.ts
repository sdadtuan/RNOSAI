import { HttpException } from '@nestjs/common';
import type { CpAiOpsProvider } from './cp-ai-ops.types';

function isOn(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export function parseRecommendSignals(body: unknown): {
  restricted: boolean;
  needsPrivateLora: boolean;
  urgentPremium: boolean;
  humanCanvas: boolean;
} {
  const raw = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  return {
    restricted: isOn(raw.restricted),
    needsPrivateLora: isOn(raw.needs_private_lora ?? raw.needsPrivateLora),
    urgentPremium: isOn(raw.urgent_premium ?? raw.urgentPremium),
    humanCanvas: isOn(raw.human_canvas ?? raw.humanCanvas),
  };
}

export function recommendProviderUp(flags: {
  magnificMcp: boolean;
  magnificRest: boolean;
  comfy: boolean;
}): { magnificUp: boolean; comfyUp: boolean } {
  return {
    magnificUp: flags.magnificMcp || flags.magnificRest,
    comfyUp: flags.comfy,
  };
}

export function buildRecommendPayload(input: {
  restricted: boolean;
  needsPrivateLora: boolean;
  urgentPremium: boolean;
  humanCanvas: boolean;
  magnificUp: boolean;
  comfyUp: boolean;
}): {
  provider: CpAiOpsProvider;
  reason_codes: string[];
  provider_mode: 'recommended';
  submitted: false;
} {
  const out = recommendProvider(input);
  return {
    provider: out.provider,
    reason_codes: out.reasonCodes,
    provider_mode: 'recommended',
    submitted: false,
  };
}

export function recommendProvider(input: {
  restricted: boolean;
  needsPrivateLora: boolean;
  urgentPremium: boolean;
  humanCanvas: boolean;
  magnificUp: boolean;
  comfyUp: boolean;
}): { provider: CpAiOpsProvider; reasonCodes: string[] } {
  if (input.humanCanvas) {
    return { provider: 'weavy', reasonCodes: ['WEAVE_HUMAN_CANVAS'] };
  }

  const restrictedCodes = buildRestrictedReasonCodes(input.restricted, input.needsPrivateLora);
  if (restrictedCodes.length > 0) {
    if (!input.comfyUp) {
      rejectProviderDown(restrictedCodes);
    }
    return { provider: 'comfyui', reasonCodes: restrictedCodes };
  }

  if (input.urgentPremium && input.magnificUp) {
    return { provider: 'magnific_mcp', reasonCodes: ['URGENT_PREMIUM'] };
  }

  return { provider: 'weavy', reasonCodes: [] };
}

function buildRestrictedReasonCodes(restricted: boolean, needsPrivateLora: boolean): string[] {
  const codes: string[] = [];
  if (restricted) codes.push('RESTRICTED');
  if (needsPrivateLora) codes.push('PRIVATE_LORA');
  return codes;
}

function rejectProviderDown(reasonCodes: string[]): never {
  const body = { error: 'provider_rejected', gate: 'PROVIDER_DOWN', reasonCodes };
  throw Object.assign(new HttpException(body, 409), body);
}

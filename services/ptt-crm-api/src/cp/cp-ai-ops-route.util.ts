import { HttpException } from '@nestjs/common';
import type { CpAiOpsProvider } from './cp-ai-ops.types';

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

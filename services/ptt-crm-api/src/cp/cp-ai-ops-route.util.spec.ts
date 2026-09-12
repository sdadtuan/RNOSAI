import { recommendProvider } from './cp-ai-ops-route.util';

const base = {
  restricted: false,
  needsPrivateLora: false,
  urgentPremium: false,
  humanCanvas: false,
  magnificUp: true,
  comfyUp: true,
};

describe('recommendProvider', () => {
  it('prefers weavy for human canvas', () => {
    expect(
      recommendProvider({ ...base, humanCanvas: true, restricted: true, urgentPremium: true }),
    ).toEqual({ provider: 'weavy', reasonCodes: ['WEAVE_HUMAN_CANVAS'] });
  });

  it('routes restricted work to comfyui when up', () => {
    expect(recommendProvider({ ...base, restricted: true })).toEqual({
      provider: 'comfyui',
      reasonCodes: ['RESTRICTED'],
    });
  });

  it('routes private lora to comfyui when up', () => {
    expect(recommendProvider({ ...base, needsPrivateLora: true })).toEqual({
      provider: 'comfyui',
      reasonCodes: ['PRIVATE_LORA'],
    });
  });

  it('includes both reason codes when restricted and private lora', () => {
    expect(
      recommendProvider({ ...base, restricted: true, needsPrivateLora: true }),
    ).toEqual({
      provider: 'comfyui',
      reasonCodes: ['RESTRICTED', 'PRIVATE_LORA'],
    });
  });

  it('rejects restricted work when comfy is down', () => {
    expect(() =>
      recommendProvider({ ...base, restricted: true, comfyUp: false }),
    ).toThrow(
      expect.objectContaining({
        error: 'provider_rejected',
        gate: 'PROVIDER_DOWN',
        reasonCodes: ['RESTRICTED'],
      }),
    );
  });

  it('rejects private lora when comfy is down', () => {
    expect(() =>
      recommendProvider({ ...base, needsPrivateLora: true, comfyUp: false }),
    ).toThrow(
      expect.objectContaining({
        error: 'provider_rejected',
        gate: 'PROVIDER_DOWN',
        reasonCodes: ['PRIVATE_LORA'],
      }),
    );
  });

  it('routes urgent premium to magnific mcp when up', () => {
    expect(recommendProvider({ ...base, urgentPremium: true })).toEqual({
      provider: 'magnific_mcp',
      reasonCodes: ['URGENT_PREMIUM'],
    });
  });

  it('falls back to weavy when urgent premium but magnific is down', () => {
    expect(
      recommendProvider({ ...base, urgentPremium: true, magnificUp: false }),
    ).toEqual({ provider: 'weavy', reasonCodes: [] });
  });

  it('defaults to weavy with no reason codes', () => {
    expect(recommendProvider(base)).toEqual({ provider: 'weavy', reasonCodes: [] });
  });
});

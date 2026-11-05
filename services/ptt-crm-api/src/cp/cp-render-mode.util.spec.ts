import {
  normalizeRenderProvider,
  pricingVersionForProvider,
  resolveRenderProvider,
} from './cp-render-mode.util';

describe('cp-render-mode.util', () => {
  it('normalizes provider aliases', () => {
    expect(normalizeRenderProvider('stub')).toBe('stub');
    expect(normalizeRenderProvider('video_sop')).toBe('video_sop');
    expect(normalizeRenderProvider('sop')).toBe('video_sop');
    expect(normalizeRenderProvider('unknown')).toBeNull();
  });

  it('prefers draft override over env', () => {
    expect(resolveRenderProvider({
      config: { render_provider: 'stub' },
      env: { CP_RENDER_MODE: 'sop' },
    })).toBe('stub');
  });

  it('uses routing_json when draft has no override', () => {
    expect(resolveRenderProvider({
      routing: { render_provider: 'video_sop' },
      env: { CP_RENDER_MODE: 'stub' },
    })).toBe('video_sop');
  });

  it('auto mode picks video_sop for TVC playbook', () => {
    expect(resolveRenderProvider({
      config: { playbook_id: 'tvc_short_169' },
      env: { CP_RENDER_MODE: 'auto' },
    })).toBe('video_sop');
  });

  it('maps pricing versions by provider', () => {
    expect(pricingVersionForProvider('stub')).toBe('stub-2026-09');
    expect(pricingVersionForProvider('video_sop')).toBe('sop-2026-09');
  });
});

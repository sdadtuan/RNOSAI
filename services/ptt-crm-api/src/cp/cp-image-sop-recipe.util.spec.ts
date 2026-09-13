import { readAiOpsFlags } from './cp-ai-ops.flags';
import { compileRecipe } from './cp-image-sop-recipe.util';

describe('compileRecipe', () => {
  it('blocks explore when magnific disconnected', () => {
    const out = compileRecipe({
      intent: 'hero_lifestyle',
      flags: readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: '1' }),
      hasMagnificConnection: false,
    });
    expect(out.blocked_reason).toBe('magnific_disconnected');
  });

  it('uses local sharp for format_pack when magnific down', () => {
    const pack = compileRecipe({
      intent: 'format_pack',
      flags: readAiOpsFlags({}),
      hasMagnificConnection: false,
    }).stages.find((s) => s.stage === 'pack');
    expect(pack?.provider).toBe('local');
  });

  it('builds hero_lifestyle pipeline when magnific connected', () => {
    const out = compileRecipe({
      intent: 'hero_lifestyle',
      flags: readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: '1' }),
      hasMagnificConnection: true,
    });
    expect(out.blocked_reason).toBeNull();
    expect(out.stages.map((s) => s.stage)).toContain('explore');
    expect(out.stages.find((s) => s.stage === 'explore')?.provider).toBe('magnific_rest');
  });

  it('blocks human_art when weave disabled', () => {
    const out = compileRecipe({
      intent: 'human_art',
      flags: readAiOpsFlags({}),
      hasMagnificConnection: false,
    });
    expect(out.blocked_reason).toBe('weave_disabled');
  });
});

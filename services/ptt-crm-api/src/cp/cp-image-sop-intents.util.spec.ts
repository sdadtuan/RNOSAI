import { isImgIntent, listIntentCatalog } from './cp-image-sop-intents.util';

describe('cp-image-sop-intents.util', () => {
  it('lists 8 intents from catalog', () => {
    expect(listIntentCatalog()).toHaveLength(8);
  });

  it('validates known intents', () => {
    expect(isImgIntent('hero_lifestyle')).toBe(true);
    expect(isImgIntent('text_cta')).toBe(true);
    expect(isImgIntent('flux_generate')).toBe(false);
  });
});

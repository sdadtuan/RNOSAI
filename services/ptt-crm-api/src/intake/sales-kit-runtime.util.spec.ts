import { resolveKitMode, parseSalesKitMode, type SalesKitLlmMode } from './sales-kit-runtime.util';

describe('sales-kit-runtime.util', () => {
  it('lock uses env even if db is ollama', () => {
    expect(
      resolveKitMode({
        locked: true,
        envMode: 'off',
        legacyOn: true,
        dbMode: 'ollama',
      }),
    ).toBe('off');
  });

  it('db wins when unlocked', () => {
    expect(
      resolveKitMode({
        locked: false,
        envMode: 'off',
        legacyOn: false,
        dbMode: 'openai',
      }),
    ).toBe('openai');
  });

  it('legacy flag maps to openai', () => {
    expect(
      resolveKitMode({
        locked: false,
        envMode: null,
        legacyOn: true,
        dbMode: null,
      }),
    ).toBe('openai');
  });

  it('parse invalid mode as null', () => {
    expect(parseSalesKitMode('gpt')).toBeNull();
  });
});

import { p13Flag, p13FlagsFromPolicy } from './p13-flag';

describe('p13Flag', () => {
  it('defaults to false', () => {
    expect(p13Flag('ENABLED', {})).toBe(false);
  });

  it('reads env truthy values', () => {
    expect(p13Flag('ENABLED', { P13_ENABLED: 'true' })).toBe(true);
    expect(p13Flag('ENABLED', { P13_ENABLED: '1' })).toBe(true);
    expect(p13Flag('QUOTE_EXPORT', { P13_QUOTE_EXPORT: 'false' })).toBe(false);
  });

  it('lets settings override env', () => {
    expect(p13Flag('ENABLED', { P13_ENABLED: 'true' }, { P13_ENABLED: false })).toBe(false);
    expect(p13Flag('ENABLED', { P13_ENABLED: 'false' }, { P13_ENABLED: true })).toBe(true);
  });
});

describe('p13FlagsFromPolicy', () => {
  it('maps booleans and ignores other types', () => {
    expect(p13FlagsFromPolicy({ P13_ENABLED: true, note: 'x' })).toEqual({ P13_ENABLED: true });
    expect(p13FlagsFromPolicy({ enabled: false })).toEqual({ P13_ENABLED: false });
  });
});

import { assertPublicAttachment } from './csd-visibility.util';

describe('csd-visibility.util', () => {
  it('throws for internal visibility', () => {
    expect(() => assertPublicAttachment('internal')).toThrow(/internal/i);
  });

  it('allows client visibility', () => {
    expect(() => assertPublicAttachment('client')).not.toThrow();
  });

  it('allows restricted visibility', () => {
    expect(() => assertPublicAttachment('restricted')).not.toThrow();
  });
});

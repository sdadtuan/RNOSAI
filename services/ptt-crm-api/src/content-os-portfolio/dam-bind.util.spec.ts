import { assertBindableDamUrl, parseDamBindBody } from './dam-bind.util';

describe('assertBindableDamUrl', () => {
  it('allows https on allowlist host and rejects javascript', () => {
    expect(assertBindableDamUrl('https://dam.example.internal/a.jpg', 'dam.example.internal'))
      .toBe('https://dam.example.internal/a.jpg');
    expect(() => assertBindableDamUrl('javascript:alert(1)', 'dam.example.internal')).toThrow('dam_invalid_response');
    expect(() => assertBindableDamUrl('https://evil.example/a.jpg', 'dam.example.internal')).toThrow('dam_invalid_response');
  });

  it('rejects data and http urls', () => {
    expect(() => assertBindableDamUrl('data:text/plain,hi', 'dam.example.internal')).toThrow(
      'dam_invalid_response',
    );
    expect(() => assertBindableDamUrl('http://dam.example.internal/a.jpg', 'dam.example.internal')).toThrow(
      'dam_invalid_response',
    );
  });

  it('strips signed query from the stored host path', () => {
    expect(
      assertBindableDamUrl(
        'https://dam.example.internal/a.jpg?X-Amz-Signature=secret',
        'dam.example.internal',
      ),
    ).toBe('https://dam.example.internal/a.jpg');
  });
});

describe('parseDamBindBody', () => {
  it('keeps only DamRightsMetadata fields and drops token', () => {
    const parsed = parseDamBindBody({
      dam_id: 'a1',
      url: 'https://dam.example.internal/a.jpg',
      rights: { status: 'Valid', token: 'x', secret: 'y' },
    });
    expect(parsed.rights).toEqual({ status: 'Valid' });
    expect(JSON.stringify(parsed)).not.toMatch(/token|secret/);
  });
});

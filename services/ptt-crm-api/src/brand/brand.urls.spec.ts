import { assertCanDeleteHero, assertImageUpload, brandFileUrl } from './brand.urls';

describe('brand.urls', () => {
  it('builds cache-busted public file url', () => {
    expect(brandFileUrl('https://rs.pttads.vn', 'logo', 'logo.png', '2026-08-25T00:00:00.000Z')).toBe(
      'https://rs.pttads.vn/api/v1/public/brand/files/logo/logo.png?v=2026-08-25T00%3A00%3A00.000Z',
    );
  });

  it('rejects deleting the active hero', () => {
    expect(() => assertCanDeleteHero('h1', 'h1')).toThrow('hero_in_use');
    expect(() => assertCanDeleteHero('h1', 'h2')).not.toThrow();
  });

  it('rejects non-image or oversized files', () => {
    expect(() => assertImageUpload({ mimetype: 'application/pdf', size: 10 }, 100)).toThrow(
      'invalid_image',
    );
    expect(() => assertImageUpload({ mimetype: 'image/png', size: 200 }, 100)).toThrow(
      'file_too_large',
    );
    expect(() => assertImageUpload({ mimetype: 'image/png', size: 50 }, 100)).not.toThrow();
  });
});

import { BrandService } from './brand.service';

describe('BrandService', () => {
  it('refuses to delete the active hero', async () => {
    const svc = BrandService.createForTest();
    await expect(svc.deleteHero(svc.snapshot().settings.active_hero_id)).rejects.toThrow(
      'hero_in_use',
    );
  });

  it('allows deleting a non-active hero', async () => {
    const svc = BrandService.createForTest();
    await expect(svc.deleteHero('h2')).resolves.toBeUndefined();
    expect(svc.snapshot().heroes.has('h2')).toBe(false);
  });

  it('builds public dto with logo and hero urls', async () => {
    const svc = BrandService.createForTest();
    const dto = await svc.getPublic('https://rs.pttads.vn');
    expect(dto.logo_url).toContain('/api/v1/public/brand/files/logo/');
    expect(dto.hero_url).toContain('/api/v1/public/brand/files/hero/');
  });
});

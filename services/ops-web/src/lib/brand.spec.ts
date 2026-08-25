import { describe, expect, it } from 'vitest';
import { publicBrandFromJson } from './brand';

describe('brand', () => {
  it('parses public brand dto', () => {
    const dto = publicBrandFromJson({
      logo_url: 'https://rs.pttads.vn/api/v1/public/brand/files/logo/logo.png?v=1',
      hero_url: 'https://rs.pttads.vn/api/v1/public/brand/files/hero/h.jpg?v=1',
      updated_at: '1',
    });
    expect(dto.logo_url).toContain('/api/v1/public/brand/files/logo/');
  });
});

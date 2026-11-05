import { API_BASE } from './api';

export type PublicBrand = {
  logo_url: string;
  hero_url: string;
  updated_at: string;
};

export function publicBrandFromJson(raw: unknown): PublicBrand {
  const dto = raw as Partial<PublicBrand>;
  if (!dto.logo_url || !dto.hero_url || !dto.updated_at) {
    throw new Error('invalid_brand');
  }
  return {
    logo_url: dto.logo_url,
    hero_url: dto.hero_url,
    updated_at: dto.updated_at,
  };
}

export async function fetchPublicBrand(): Promise<PublicBrand> {
  const res = await fetch(`${API_BASE}/api/v1/public/brand`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('brand_fetch_failed');
  }
  return publicBrandFromJson(await res.json());
}

export type AdminBrand = PublicBrand & {
  heroes: Array<{
    id: string;
    filename: string;
    url: string;
    active: boolean;
  }>;
};

export function adminBrandFromJson(raw: unknown): AdminBrand {
  const dto = raw as AdminBrand;
  return {
    ...publicBrandFromJson(dto),
    heroes: Array.isArray(dto.heroes) ? dto.heroes : [],
  };
}

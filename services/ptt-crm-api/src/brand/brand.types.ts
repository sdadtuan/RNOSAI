export type PublicBrandDto = {
  logo_url: string;
  hero_url: string;
  updated_at: string;
};

export type BrandHeroRow = {
  id: string;
  filename: string;
};

export type BrandSettingsRow = {
  logo_asset_id: string;
  active_hero_id: string;
  updated_at: string;
};

export type BrandStore = {
  settings: BrandSettingsRow;
  heroes: Map<string, BrandHeroRow>;
};

export type BrandHeroListItem = {
  id: string;
  filename: string;
  url: string;
  active: boolean;
};

export type AdminBrandDto = PublicBrandDto & {
  heroes: BrandHeroListItem[];
};

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

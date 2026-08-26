export type VnProvinceRow = {
  code: string;
  name: string;
  name_en: string;
  sort_order: number;
  active: boolean;
  source: string;
  ward_count?: number;
};

export type VnWardRow = {
  code: string;
  province_code: string;
  province_name?: string;
  name: string;
  name_en: string;
  sort_order: number;
  active: boolean;
  source: string;
};

export type CreateVnProvinceBody = {
  code: string;
  name: string;
  name_en?: string;
  sort_order?: number;
  active?: boolean;
};

export type PatchVnProvinceBody = Partial<Omit<CreateVnProvinceBody, 'code'>> & { code?: string };

export type CreateVnWardBody = {
  code: string;
  province_code: string;
  name: string;
  name_en?: string;
  sort_order?: number;
  active?: boolean;
};

export type PatchVnWardBody = Partial<Omit<CreateVnWardBody, 'code'>> & { code?: string };

export type VnGeoSyncResult = {
  ok: true;
  provinces: number;
  wards: number;
  source: string;
};

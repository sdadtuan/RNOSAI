import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VnAdminGeoRepository } from './vn-admin-geo.repository';
import type {
  CreateVnProvinceBody,
  CreateVnWardBody,
  PatchVnProvinceBody,
  PatchVnWardBody,
  VnGeoSyncResult,
  VnProvinceRow,
  VnWardRow,
} from './vn-admin-geo.types';

@Injectable()
export class VnAdminGeoService {
  constructor(private readonly repo: VnAdminGeoRepository) {}

  private async ensureReady(): Promise<void> {
    if (!(await this.repo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'vn_geo_tables_missing' });
    }
  }

  async listProvinces(includeInactive = false): Promise<{ provinces: VnProvinceRow[] }> {
    await this.ensureReady();
    return { provinces: await this.repo.listProvinces(includeInactive) };
  }

  async listWards(provinceCode?: string, includeInactive = false): Promise<{ wards: VnWardRow[] }> {
    await this.ensureReady();
    return { wards: await this.repo.listWards(provinceCode, includeInactive) };
  }

  async createProvince(body: CreateVnProvinceBody): Promise<{ province: VnProvinceRow }> {
    await this.ensureReady();
    try {
      return { province: await this.repo.createProvince(body) };
    } catch (err) {
      if (String(err).includes('duplicate') || (err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'province_code_exists' });
      }
      throw new BadRequestException({ error: 'invalid_province' });
    }
  }

  async patchProvince(code: string, body: PatchVnProvinceBody): Promise<{ province: VnProvinceRow }> {
    await this.ensureReady();
    try {
      return { province: await this.repo.patchProvince(code, body) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'province_not_found') throw new NotFoundException({ error: msg });
      if (msg === 'empty_patch') throw new BadRequestException({ error: msg });
      throw new BadRequestException({ error: 'patch_province_failed' });
    }
  }

  async deleteProvince(code: string): Promise<{ ok: true }> {
    await this.ensureReady();
    try {
      await this.repo.deleteProvince(code);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'province_has_wards') throw new ConflictException({ error: msg });
      throw new BadRequestException({ error: 'delete_province_failed' });
    }
  }

  async createWard(body: CreateVnWardBody): Promise<{ ward: VnWardRow }> {
    await this.ensureReady();
    try {
      return { ward: await this.repo.createWard(body) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'province_not_found') throw new BadRequestException({ error: msg });
      if ((err as { code?: string }).code === '23505') throw new ConflictException({ error: 'ward_code_exists' });
      throw new BadRequestException({ error: 'invalid_ward' });
    }
  }

  async patchWard(code: string, body: PatchVnWardBody): Promise<{ ward: VnWardRow }> {
    await this.ensureReady();
    try {
      return { ward: await this.repo.patchWard(code, body) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'ward_not_found') throw new NotFoundException({ error: msg });
      if (msg === 'province_not_found') throw new BadRequestException({ error: msg });
      if (msg === 'empty_patch') throw new BadRequestException({ error: msg });
      throw new BadRequestException({ error: 'patch_ward_failed' });
    }
  }

  async deleteWard(code: string): Promise<{ ok: true }> {
    await this.ensureReady();
    await this.repo.deleteWard(code);
    return { ok: true };
  }

  async syncFromNationalSource(): Promise<VnGeoSyncResult> {
    await this.ensureReady();
    return this.repo.syncFromOpenAdminData();
  }
}

import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateVnProvinceBody,
  CreateVnWardBody,
  PatchVnProvinceBody,
  PatchVnWardBody,
  VnGeoSyncResult,
  VnProvinceRow,
  VnWardRow,
} from './vn-admin-geo.types';

const PROVINCE_URL =
  'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-province.json';
const WARD_URL =
  'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-ward.json';

function wardDisplayName(row: {
  name?: { local?: string };
  level_name?: { local?: string };
}): string {
  const local = String(row?.name?.local ?? '').trim();
  const level = String(row?.level_name?.local ?? '').trim();
  if (!local) return '';
  if (level && !local.toLowerCase().startsWith('phường') && !local.toLowerCase().startsWith('xã')) {
    const prefix = level.includes('/') ? 'Phường/Xã' : level;
    return `${prefix} ${local}`;
  }
  return local;
}

@Injectable()
export class VnAdminGeoRepository {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async tablesReady(): Promise<boolean> {
    const r = await this.db.query(
      `SELECT to_regclass('public.vn_provinces') AS p, to_regclass('public.vn_wards') AS w`,
    );
    return Boolean(r.rows[0]?.p && r.rows[0]?.w);
  }

  async listProvinces(includeInactive = false): Promise<VnProvinceRow[]> {
    const r = await this.db.query(
      `SELECT p.code, p.name, p.name_en, p.sort_order, p.active, p.source,
              (SELECT count(*)::int FROM vn_wards w WHERE w.province_code = p.code) AS ward_count
       FROM vn_provinces p
       ${includeInactive ? '' : 'WHERE p.active IS TRUE'}
       ORDER BY p.sort_order, p.name`,
    );
    return r.rows.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      name_en: String(row.name_en ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      active: row.active === true,
      source: String(row.source ?? ''),
      ward_count: Number(row.ward_count ?? 0),
    }));
  }

  async listWards(provinceCode?: string, includeInactive = false): Promise<VnWardRow[]> {
    const params: string[] = [];
    const where: string[] = [];
    if (provinceCode?.trim()) {
      params.push(provinceCode.trim());
      where.push(`w.province_code = $${params.length}`);
    }
    if (!includeInactive) where.push('w.active IS TRUE');
    const r = await this.db.query(
      `SELECT w.code, w.province_code, p.name AS province_name, w.name, w.name_en,
              w.sort_order, w.active, w.source
       FROM vn_wards w
       JOIN vn_provinces p ON p.code = w.province_code
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY w.sort_order, w.name`,
      params,
    );
    return r.rows.map((row) => ({
      code: String(row.code),
      province_code: String(row.province_code),
      province_name: String(row.province_name ?? ''),
      name: String(row.name),
      name_en: String(row.name_en ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      active: row.active === true,
      source: String(row.source ?? ''),
    }));
  }

  async assertProvinceExists(code: string): Promise<void> {
    const r = await this.db.query(`SELECT 1 FROM vn_provinces WHERE code = $1`, [code]);
    if (!r.rowCount) throw new Error('province_not_found');
  }

  async createProvince(body: CreateVnProvinceBody): Promise<VnProvinceRow> {
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new Error('invalid_province');
    await this.db.query(
      `INSERT INTO vn_provinces (code, name, name_en, sort_order, active, source)
       VALUES ($1, $2, $3, $4, $5, 'manual')`,
      [code, name, String(body.name_en ?? ''), body.sort_order ?? 0, body.active !== false],
    );
    const rows = await this.listProvinces(true);
    return rows.find((p) => p.code === code)!;
  }

  async patchProvince(code: string, body: PatchVnProvinceBody): Promise<VnProvinceRow> {
    const fields: string[] = [];
    const params: unknown[] = [code];
    if (body.name != null) {
      params.push(String(body.name).trim());
      fields.push(`name = $${params.length}`);
    }
    if (body.name_en != null) {
      params.push(String(body.name_en).trim());
      fields.push(`name_en = $${params.length}`);
    }
    if (body.sort_order != null) {
      params.push(body.sort_order);
      fields.push(`sort_order = $${params.length}`);
    }
    if (body.active != null) {
      params.push(body.active);
      fields.push(`active = $${params.length}`);
    }
    if (!fields.length) throw new Error('empty_patch');
    fields.push('updated_at = now()');
    await this.db.query(`UPDATE vn_provinces SET ${fields.join(', ')} WHERE code = $1`, params);
    const rows = await this.listProvinces(true);
    const row = rows.find((p) => p.code === code);
    if (!row) throw new Error('province_not_found');
    return row;
  }

  async deleteProvince(code: string): Promise<void> {
    const used = await this.db.query(
      `SELECT 1 FROM vn_wards WHERE province_code = $1 LIMIT 1`,
      [code],
    );
    if (used.rowCount) throw new Error('province_has_wards');
    await this.db.query(`DELETE FROM vn_provinces WHERE code = $1`, [code]);
  }

  async createWard(body: CreateVnWardBody): Promise<VnWardRow> {
    const code = String(body.code ?? '').trim();
    const province_code = String(body.province_code ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!code || !province_code || !name) throw new Error('invalid_ward');
    await this.assertProvinceExists(province_code);
    await this.db.query(
      `INSERT INTO vn_wards (code, province_code, name, name_en, sort_order, active, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual')`,
      [code, province_code, name, String(body.name_en ?? ''), body.sort_order ?? 0, body.active !== false],
    );
    const rows = await this.listWards(province_code, true);
    return rows.find((w) => w.code === code)!;
  }

  async patchWard(code: string, body: PatchVnWardBody): Promise<VnWardRow> {
    const fields: string[] = [];
    const params: unknown[] = [code];
    if (body.code != null && body.code.trim() && body.code.trim() !== code) {
      params.push(body.code.trim());
      fields.push(`code = $${params.length}`);
    }
    if (body.province_code != null) {
      await this.assertProvinceExists(String(body.province_code).trim());
      params.push(String(body.province_code).trim());
      fields.push(`province_code = $${params.length}`);
    }
    if (body.name != null) {
      params.push(String(body.name).trim());
      fields.push(`name = $${params.length}`);
    }
    if (body.name_en != null) {
      params.push(String(body.name_en).trim());
      fields.push(`name_en = $${params.length}`);
    }
    if (body.sort_order != null) {
      params.push(body.sort_order);
      fields.push(`sort_order = $${params.length}`);
    }
    if (body.active != null) {
      params.push(body.active);
      fields.push(`active = $${params.length}`);
    }
    if (!fields.length) throw new Error('empty_patch');
    fields.push('updated_at = now()');
    await this.db.query(`UPDATE vn_wards SET ${fields.join(', ')} WHERE code = $1`, params);
    const nextCode = body.code?.trim() && body.code.trim() !== code ? body.code.trim() : code;
    const r = await this.db.query(
      `SELECT w.code, w.province_code, p.name AS province_name, w.name, w.name_en,
              w.sort_order, w.active, w.source
       FROM vn_wards w JOIN vn_provinces p ON p.code = w.province_code
       WHERE w.code = $1`,
      [nextCode],
    );
    if (!r.rowCount) throw new Error('ward_not_found');
    const row = r.rows[0];
    return {
      code: String(row.code),
      province_code: String(row.province_code),
      province_name: String(row.province_name ?? ''),
      name: String(row.name),
      name_en: String(row.name_en ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      active: row.active === true,
      source: String(row.source ?? ''),
    };
  }

  async deleteWard(code: string): Promise<void> {
    await this.db.query(`DELETE FROM vn_wards WHERE code = $1`, [code]);
  }

  async syncFromOpenAdminData(): Promise<VnGeoSyncResult> {
    const [provincesRaw, wardsRaw] = await Promise.all([
      fetch(PROVINCE_URL).then((r) => {
        if (!r.ok) throw new Error(`fetch_provinces_${r.status}`);
        return r.json();
      }),
      fetch(WARD_URL).then((r) => {
        if (!r.ok) throw new Error(`fetch_wards_${r.status}`);
        return r.json();
      }),
    ]);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      let pCount = 0;
      let wCount = 0;
      for (let idx = 0; idx < provincesRaw.length; idx++) {
        const p = provincesRaw[idx];
        const code = String(p.id ?? p.code?.id ?? '').trim();
        const name = String(p.name?.local ?? '').trim();
        if (!code || !name) continue;
        await client.query(
          `INSERT INTO vn_provinces (code, name, name_en, sort_order, active, source, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, 'open-admin-data', now())
           ON CONFLICT (code) DO UPDATE SET
             name = EXCLUDED.name, name_en = EXCLUDED.name_en,
             sort_order = EXCLUDED.sort_order, source = EXCLUDED.source, updated_at = now()`,
          [code, name, String(p.name?.en ?? ''), idx],
        );
        pCount++;
      }
      for (let idx = 0; idx < wardsRaw.length; idx++) {
        const w = wardsRaw[idx];
        const code = String(w.id ?? w.code?.id ?? '').trim();
        const province_code = String(w.parent?.id ?? '').trim();
        const name = wardDisplayName(w);
        if (!code || !province_code || !name) continue;
        await client.query(
          `INSERT INTO vn_wards (code, province_code, name, name_en, sort_order, active, source, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'open-admin-data', now())
           ON CONFLICT (code) DO UPDATE SET
             province_code = EXCLUDED.province_code, name = EXCLUDED.name,
             name_en = EXCLUDED.name_en, sort_order = EXCLUDED.sort_order,
             source = EXCLUDED.source, updated_at = now()`,
          [code, province_code, name, String(w.name?.en ?? ''), idx],
        );
        wCount++;
      }
      await client.query('COMMIT');
      return { ok: true, provinces: pCount, wards: wCount, source: 'open-admin-data' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

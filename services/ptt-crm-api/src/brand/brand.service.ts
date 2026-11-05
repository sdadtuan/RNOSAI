import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  AdminBrandDto,
  BrandHeroListItem,
  BrandStore,
  PublicBrandDto,
  UploadedImageFile,
} from './brand.types';
import {
  assertCanDeleteHero,
  assertImageUpload,
  brandFileUrl,
  contentTypeForFilename,
} from './brand.urls';

const LOGO_MAX_BYTES = 2_000_000;
const HERO_MAX_BYTES = 8_000_000;
const SEED_HERO_ID = 'seed';

@Injectable()
export class BrandService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private store: BrandStore = {
    settings: {
      logo_asset_id: 'logo.png',
      active_hero_id: SEED_HERO_ID,
      updated_at: new Date(0).toISOString(),
    },
    heroes: new Map([[SEED_HERO_ID, { id: SEED_HERO_ID, filename: 'login-hero.jpg' }]]),
  };

  readonly dataDir: string;
  readonly seedDir: string;

  constructor(private readonly config: AppConfigService) {
    this.dataDir = process.env.BRAND_DATA_DIR
      ? path.resolve(process.env.BRAND_DATA_DIR)
      : path.resolve(process.cwd(), 'data/brand');
    this.seedDir = path.resolve(process.cwd(), '../../docs/brand');
  }

  static createForTest(overrides?: Partial<{ store: BrandStore }>): BrandService {
    const config = { databaseUrl: '' } as AppConfigService;
    const svc = new BrandService(config);
    (svc as unknown as { pgReady: boolean | null }).pgReady = false;
    svc.store = overrides?.store ?? {
      settings: {
        logo_asset_id: 'logo.png',
        active_hero_id: SEED_HERO_ID,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      heroes: new Map([
        [SEED_HERO_ID, { id: SEED_HERO_ID, filename: 'login-hero.jpg' }],
        ['h2', { id: 'h2', filename: 'other.jpg' }],
      ]),
    };
    return svc;
  }

  snapshot(): BrandStore {
    return this.store;
  }

  private get db(): Pool {
    if (!this.pool && this.config.databaseUrl) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    if (!this.pool) {
      throw new Error('database_unavailable');
    }
    return this.pool;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
    await this.loadFromPg();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private logoPath(filename: string): string {
    return path.join(this.dataDir, 'logo', filename);
  }

  private heroPath(filename: string): string {
    return path.join(this.dataDir, 'hero', filename);
  }

  private filePath(kind: 'logo' | 'hero', filename: string): string {
    return kind === 'logo' ? this.logoPath(filename) : this.heroPath(filename);
  }

  private touchUpdatedAt(): string {
    const updatedAt = new Date().toISOString();
    this.store.settings.updated_at = updatedAt;
    return updatedAt;
  }

  private toPublicDto(publicBase: string): PublicBrandDto {
    const { settings, heroes } = this.store;
    const hero = heroes.get(settings.active_hero_id);
    if (!hero) {
      throw new Error('hero_missing');
    }
    return {
      logo_url: brandFileUrl(publicBase, 'logo', settings.logo_asset_id, settings.updated_at),
      hero_url: brandFileUrl(publicBase, 'hero', hero.filename, settings.updated_at),
      updated_at: settings.updated_at,
    };
  }

  private toAdminDto(publicBase: string): AdminBrandDto {
    const pub = this.toPublicDto(publicBase);
    const heroes = this.listHeroesSync(publicBase);
    return { ...pub, heroes };
  }

  private listHeroesSync(publicBase: string): BrandHeroListItem[] {
    const { settings } = this.store;
    return [...this.store.heroes.values()].map((hero) => ({
      id: hero.id,
      filename: hero.filename,
      url: brandFileUrl(publicBase, 'hero', hero.filename, settings.updated_at),
      active: hero.id === settings.active_hero_id,
    }));
  }

  async ensureSeeded(): Promise<void> {
    await mkdir(path.join(this.dataDir, 'logo'), { recursive: true });
    await mkdir(path.join(this.dataDir, 'hero'), { recursive: true });

    const logoDest = this.logoPath('logo.png');
    const heroDest = this.heroPath('login-hero.jpg');

    try {
      await readFile(logoDest);
    } catch {
      await copyFile(path.join(this.seedDir, 'ptt-logo.png'), logoDest);
    }

    try {
      await readFile(heroDest);
    } catch {
      await copyFile(path.join(this.seedDir, 'login-hero.jpg'), heroDest);
    }

    if (!(await this.ensurePgReady())) {
      if (this.store.settings.updated_at === new Date(0).toISOString()) {
        this.touchUpdatedAt();
      }
    }
  }

  private async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    if (!this.config.databaseUrl) {
      this.pgReady = false;
      return false;
    }
    try {
      await this.db.query(`SELECT 1 FROM crm_brand_settings LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private async loadFromPg(): Promise<void> {
    if (!(await this.ensurePgReady())) return;

    const settingsRes = await this.db.query<{
      logo_asset_id: string;
      active_hero_id: string;
      updated_at: Date;
    }>(`SELECT logo_asset_id, active_hero_id, updated_at FROM crm_brand_settings WHERE id = 1`);

    const heroesRes = await this.db.query<{ id: string; filename: string }>(
      `SELECT id, filename FROM crm_brand_heroes ORDER BY created_at ASC`,
    );

    if (settingsRes.rowCount === 0) {
      await this.persistSeedToPg();
      return;
    }

    const row = settingsRes.rows[0];
    this.store.settings = {
      logo_asset_id: row.logo_asset_id,
      active_hero_id: row.active_hero_id,
      updated_at: new Date(row.updated_at).toISOString(),
    };
    this.store.heroes = new Map(
      heroesRes.rows.map((hero) => [hero.id, { id: hero.id, filename: hero.filename }]),
    );
  }

  private async persistSeedToPg(): Promise<void> {
    if (!(await this.ensurePgReady())) return;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO crm_brand_heroes (id, filename) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [SEED_HERO_ID, 'login-hero.jpg'],
      );
      const updatedAt = this.touchUpdatedAt();
      await client.query(
        `INSERT INTO crm_brand_settings (id, logo_asset_id, active_hero_id, updated_at)
         VALUES (1, $1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        ['logo.png', SEED_HERO_ID, updatedAt],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async persistSettings(): Promise<void> {
    if (!(await this.ensurePgReady())) return;
    const { settings } = this.store;
    await this.db.query(
      `INSERT INTO crm_brand_settings (id, logo_asset_id, active_hero_id, updated_at)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         logo_asset_id = EXCLUDED.logo_asset_id,
         active_hero_id = EXCLUDED.active_hero_id,
         updated_at = EXCLUDED.updated_at`,
      [settings.logo_asset_id, settings.active_hero_id, settings.updated_at],
    );
  }

  async getPublic(publicBase: string): Promise<PublicBrandDto> {
    await this.ensureSeeded();
    return this.toPublicDto(publicBase);
  }

  async getAdmin(publicBase: string): Promise<AdminBrandDto> {
    await this.ensureSeeded();
    return this.toAdminDto(publicBase);
  }

  async readFile(
    kind: 'logo' | 'hero',
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    await this.ensureSeeded();
    const buffer = await readFile(this.filePath(kind, filename));
    return { buffer, contentType: contentTypeForFilename(filename) };
  }

  async replaceLogo(file: UploadedImageFile, publicBase: string): Promise<PublicBrandDto> {
    assertImageUpload(file, LOGO_MAX_BYTES);
    await this.ensureSeeded();

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `logo${ext}`;
    await writeFile(this.filePath('logo', filename), file.buffer);

    if (filename !== this.store.settings.logo_asset_id) {
      const old = this.store.settings.logo_asset_id;
      if (old && old !== filename) {
        try {
          await unlink(this.logoPath(old));
        } catch {
          /* ignore missing old logo */
        }
      }
    }

    this.store.settings.logo_asset_id = filename;
    this.touchUpdatedAt();
    await this.persistSettings();
    return this.toPublicDto(publicBase);
  }

  async addHero(file: UploadedImageFile): Promise<{ id: string }> {
    assertImageUpload(file, HERO_MAX_BYTES);
    await this.ensureSeeded();

    const id = randomUUID();
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${id}${ext}`;
    await writeFile(this.heroPath(filename), file.buffer);

    const hero = { id, filename };
    this.store.heroes.set(id, hero);

    if (await this.ensurePgReady()) {
      await this.db.query(`INSERT INTO crm_brand_heroes (id, filename) VALUES ($1, $2)`, [
        id,
        filename,
      ]);
    }

    return { id };
  }

  async activateHero(id: string, publicBase: string): Promise<PublicBrandDto> {
    if (!this.store.heroes.has(id)) {
      throw new Error('hero_not_found');
    }
    this.store.settings.active_hero_id = id;
    this.touchUpdatedAt();
    await this.persistSettings();
    return this.toPublicDto(publicBase);
  }

  async deleteHero(id: string): Promise<void> {
    assertCanDeleteHero(this.store.settings.active_hero_id, id);
    const hero = this.store.heroes.get(id);
    if (!hero) {
      throw new Error('hero_not_found');
    }

    this.store.heroes.delete(id);
    try {
      await unlink(this.heroPath(hero.filename));
    } catch {
      /* ignore */
    }

    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM crm_brand_heroes WHERE id = $1`, [id]);
    }
  }

  async listHeroes(publicBase: string): Promise<BrandHeroListItem[]> {
    await this.ensureSeeded();
    return this.listHeroesSync(publicBase);
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../../config/app-config.service';
import { normalizeCompanyKey } from '../quality/dedupe.util';
import { normalizePhoneDigits } from '../quality/literal-contact.util';
import type { PlaceCandidate } from '../places/places.types';
import {
  classifyMarketEntityChange,
  marketEntityContentHash,
  type MarketEntityChange,
} from './market-content-hash.util';

export type MarketEntityUpsertInput = PlaceCandidate & {
  industry_key: string;
  province_code: string;
  intent_score?: number | null;
};

export type MarketEntityUpsertResult = {
  entity_id: string;
  change: MarketEntityChange;
};

export type MarketEntitiesSummary = {
  total: number;
  with_phone: number;
  last_seen_at: string | null;
};

@Injectable()
export class MarketEntitiesRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy() {
    await this.pool?.end();
    this.pool = null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.createSchema().catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    await this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_research_market_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        industry_key TEXT NOT NULL,
        province_code TEXT NOT NULL,
        place_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        company_name_norm TEXT,
        phone TEXT,
        phone_norm TEXT,
        email TEXT,
        website TEXT,
        address TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        places_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        intent_score INT,
        content_hash TEXT NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (industry_key, province_code, place_id)
      );
      CREATE INDEX IF NOT EXISTS idx_market_entities_industry_province
        ON crm_research_market_entities (industry_key, province_code);
      CREATE INDEX IF NOT EXISTS idx_market_entities_phone_norm
        ON crm_research_market_entities (phone_norm)
        WHERE phone_norm IS NOT NULL;
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS market_entity_id UUID
    `);
  }

  async upsertFromPlace(input: MarketEntityUpsertInput): Promise<MarketEntityUpsertResult> {
    await this.ensureSchema();
    const phoneNorm = input.phone ? normalizePhoneDigits(input.phone) : null;
    const companyNorm = normalizeCompanyKey(input.company_name);
    const contentHash = marketEntityContentHash({
      phone: input.phone,
      website: input.website,
      company_name: input.company_name,
      address: input.address,
    });

    const existing = await this.db.query(
      `SELECT id::text AS id, content_hash
       FROM crm_research_market_entities
       WHERE industry_key = $1 AND province_code = $2 AND place_id = $3`,
      [input.industry_key, input.province_code, input.place_id],
    );

    if (existing.rows[0]) {
      const prevHash = String(existing.rows[0].content_hash);
      const change = classifyMarketEntityChange(prevHash, contentHash);
      const entityId = String(existing.rows[0].id);
      await this.db.query(
        `UPDATE crm_research_market_entities SET
           company_name = $1,
           company_name_norm = $2,
           phone = $3,
           phone_norm = $4,
           website = $5,
           address = $6,
           lat = $7,
           lng = $8,
           places_json = $9::jsonb,
           intent_score = COALESCE($10, intent_score),
           content_hash = $11,
           last_seen_at = NOW()
         WHERE id = $12::uuid`,
        [
          input.company_name,
          companyNorm,
          input.phone,
          phoneNorm,
          input.website,
          input.address,
          input.lat,
          input.lng,
          JSON.stringify(input),
          input.intent_score ?? null,
          contentHash,
          entityId,
        ],
      );
      return { entity_id: entityId, change };
    }

    const inserted = await this.db.query(
      `INSERT INTO crm_research_market_entities (
         industry_key, province_code, place_id, company_name, company_name_norm,
         phone, phone_norm, website, address, lat, lng, places_json, intent_score, content_hash
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14
       ) RETURNING id::text AS id`,
      [
        input.industry_key,
        input.province_code,
        input.place_id,
        input.company_name,
        companyNorm,
        input.phone,
        phoneNorm,
        input.website,
        input.address,
        input.lat,
        input.lng,
        JSON.stringify(input),
        input.intent_score ?? null,
        contentHash,
      ],
    );
    return { entity_id: String(inserted.rows[0].id), change: 'new' };
  }

  async listSummary(
    industryKey: string,
    provinceCode: string,
  ): Promise<MarketEntitiesSummary> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE phone_norm IS NOT NULL AND phone_norm <> '')::int AS with_phone,
         MAX(last_seen_at) AS last_seen_at
       FROM crm_research_market_entities
       WHERE industry_key = $1 AND province_code = $2`,
      [industryKey, provinceCode],
    );
    const row = r.rows[0] ?? {};
    const lastSeen =
      row.last_seen_at == null
        ? null
        : row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : String(row.last_seen_at);
    return {
      total: Number(row.total ?? 0),
      with_phone: Number(row.with_phone ?? 0),
      last_seen_at: lastSeen,
    };
  }
}

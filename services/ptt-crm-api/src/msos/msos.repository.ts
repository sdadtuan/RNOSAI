import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { calendarDayConflict } from './msos-capacity.util';
import { msosDisplayCode } from './msos-ids.util';
import type {
  CapacityBucketInput,
  CreateInventoryInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  MsosCalendarDay,
  MsosInventoryRow,
  MsosPartnerRow,
  MsosPlacementRow,
  MsosRateCardRow,
  MsosRateVersionRow,
} from './msos.types';

@Injectable()
export class MsosRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async listPartners(): Promise<MsosPartnerRow[]> {
    const result = await this.db.query(
      `SELECT id::text, display_code, legal_name, status, kyc_pass, created_at::text, created_by
         FROM msos_partners
         ORDER BY created_at DESC`,
    );
    return result.rows as MsosPartnerRow[];
  }

  async createPartner(input: CreatePartnerInput): Promise<MsosPartnerRow> {
    const displayCode = msosDisplayCode('PTN');
    const result = await this.db.query(
      `INSERT INTO msos_partners (display_code, legal_name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id::text, display_code, legal_name, status, kyc_pass, created_at::text, created_by`,
      [displayCode, input.legal_name, input.staffId ?? null],
    );
    return result.rows[0] as MsosPartnerRow;
  }

  async listInventories(): Promise<MsosInventoryRow[]> {
    const result = await this.db.query(
      `SELECT id::text, display_code, name, owner_kind, partner_id::text, property_host, status, created_at::text
         FROM msos_inventories
         ORDER BY created_at DESC`,
    );
    return result.rows as MsosInventoryRow[];
  }

  async createInventory(input: CreateInventoryInput): Promise<MsosInventoryRow> {
    const displayCode = msosDisplayCode('INV');
    const result = await this.db.query(
      `INSERT INTO msos_inventories (display_code, name, owner_kind, partner_id, property_host)
       VALUES ($1, $2, $3, $4::uuid, $5)
       RETURNING id::text, display_code, name, owner_kind, partner_id::text, property_host, status, created_at::text`,
      [displayCode, input.name, input.owner_kind, input.partner_id ?? null, input.property_host ?? null],
    );
    return result.rows[0] as MsosInventoryRow;
  }

  async listPlacements(): Promise<MsosPlacementRow[]> {
    const result = await this.db.query(
      `SELECT id::text, inventory_id::text, name, format, device, geo, unit_kind,
              brand_safety_tier, backup_required, max_weight_kb, created_at::text
         FROM msos_placements
         ORDER BY created_at DESC`,
    );
    return result.rows as MsosPlacementRow[];
  }

  async createPlacement(input: CreatePlacementInput): Promise<MsosPlacementRow> {
    const result = await this.db.query(
      `INSERT INTO msos_placements (
         inventory_id, name, format, device, geo, unit_kind, backup_required, max_weight_kb
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text, inventory_id::text, name, format, device, geo, unit_kind,
                 brand_safety_tier, backup_required, max_weight_kb, created_at::text`,
      [
        input.inventory_id,
        input.name,
        input.format,
        input.device ?? null,
        input.geo ?? null,
        input.unit_kind,
        input.backup_required ?? false,
        input.max_weight_kb ?? null,
      ],
    );
    return result.rows[0] as MsosPlacementRow;
  }

  async createRateCard(input: CreateRateCardInput): Promise<MsosRateCardRow> {
    const displayCode = msosDisplayCode('RC');
    const result = await this.db.query(
      `INSERT INTO msos_rate_cards (display_code, owner_kind, partner_id)
       VALUES ($1, $2, $3::uuid)
       RETURNING id::text, display_code, owner_kind, partner_id::text, created_at::text`,
      [displayCode, input.owner_kind, input.partner_id ?? null],
    );
    return result.rows[0] as MsosRateCardRow;
  }

  async getRateVersion(rateCardId: string, version: number): Promise<MsosRateVersionRow | null> {
    const result = await this.db.query(
      `SELECT id::text, rate_card_id::text, version, status, published_at::text, published_by,
              unit_price_vnd, currency
         FROM msos_rate_versions
        WHERE rate_card_id = $1::uuid AND version = $2
        LIMIT 1`,
      [rateCardId, version],
    );
    return (result.rows[0] as MsosRateVersionRow | undefined) ?? null;
  }

  async nextRateVersionNumber(rateCardId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM msos_rate_versions
        WHERE rate_card_id = $1::uuid`,
      [rateCardId],
    );
    return Number(result.rows[0]?.next_version ?? 1);
  }

  async appendRateVersion(
    rateCardId: string,
    input: CreateRateVersionInput,
  ): Promise<MsosRateVersionRow> {
    const version = await this.nextRateVersionNumber(rateCardId);
    const result = await this.db.query(
      `INSERT INTO msos_rate_versions (rate_card_id, version, status, unit_price_vnd)
       VALUES ($1::uuid, $2, 'draft', $3)
       RETURNING id::text, rate_card_id::text, version, status, published_at::text, published_by,
                 unit_price_vnd, currency`,
      [rateCardId, version, input.unit_price_vnd],
    );
    return result.rows[0] as MsosRateVersionRow;
  }

  async publishRateVersion(
    rateCardId: string,
    version: number,
    publishedBy: number | null,
  ): Promise<MsosRateVersionRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id::text, status, unit_price_vnd
           FROM msos_rate_versions
          WHERE rate_card_id = $1::uuid AND version = $2
          FOR UPDATE`,
        [rateCardId, version],
      );
      const row = current.rows[0] as { id: string; status: string; unit_price_vnd: number } | undefined;
      if (!row) {
        await client.query('ROLLBACK');
        throw new Error('rate_version_not_found');
      }
      if (row.status === 'published') {
        await client.query('ROLLBACK');
        throw new Error('rate_version_immutable');
      }
      await client.query(
        `UPDATE msos_rate_versions
            SET status = 'expired'
          WHERE rate_card_id = $1::uuid AND status = 'published'`,
        [rateCardId],
      );
      const published = await client.query(
        `UPDATE msos_rate_versions
            SET status = 'published', published_at = now(), published_by = $3
          WHERE rate_card_id = $1::uuid AND version = $2
          RETURNING id::text, rate_card_id::text, version, status, published_at::text, published_by,
                    unit_price_vnd, currency`,
        [rateCardId, version, publishedBy],
      );
      await client.query('COMMIT');
      return published.rows[0] as MsosRateVersionRow;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateRateVersionPrice(
    rateCardId: string,
    version: number,
    unitPriceVnd: number,
  ): Promise<MsosRateVersionRow> {
    const existing = await this.getRateVersion(rateCardId, version);
    if (!existing) {
      throw new Error('rate_version_not_found');
    }
    if (existing.status === 'published') {
      throw new Error('rate_version_immutable');
    }
    const result = await this.db.query(
      `UPDATE msos_rate_versions
          SET unit_price_vnd = $3
        WHERE rate_card_id = $1::uuid AND version = $2 AND status = 'draft'
        RETURNING id::text, rate_card_id::text, version, status, published_at::text, published_by,
                  unit_price_vnd, currency`,
      [rateCardId, version, unitPriceVnd],
    );
    return result.rows[0] as MsosRateVersionRow;
  }

  async upsertCapacityBuckets(placementId: string, buckets: CapacityBucketInput[]): Promise<void> {
    for (const bucket of buckets) {
      await this.db.query(
        `INSERT INTO msos_capacity_buckets (placement_id, bucket_date, total_qty)
         VALUES ($1::uuid, $2::date, $3)
         ON CONFLICT (placement_id, bucket_date)
         DO UPDATE SET total_qty = EXCLUDED.total_qty`,
        [placementId, bucket.date, bucket.total_qty],
      );
    }
  }

  async getPlacementCalendar(placementId: string, from: string, to: string): Promise<MsosCalendarDay[]> {
    const result = await this.db.query(
      `SELECT bucket_date::text AS date, total_qty::bigint AS total,
              reserved_hard::bigint AS reserved_hard, reserved_soft::bigint AS reserved_soft
         FROM msos_capacity_buckets
        WHERE placement_id = $1::uuid
          AND bucket_date >= $2::date
          AND bucket_date <= $3::date
        ORDER BY bucket_date ASC`,
      [placementId, from, to],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => {
      const total = Number(row.total ?? 0);
      const reservedHard = Number(row.reserved_hard ?? 0);
      const reservedSoft = Number(row.reserved_soft ?? 0);
      return {
        date: String(row.date),
        total,
        reserved_hard: reservedHard,
        reserved_soft: reservedSoft,
        conflict: calendarDayConflict(total, reservedHard, reservedSoft),
      };
    });
  }

  async getPartnerStatusForPlacement(placementId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT p.status
         FROM msos_placements pl
         JOIN msos_inventories i ON i.id = pl.inventory_id
         LEFT JOIN msos_partners p ON p.id = i.partner_id
        WHERE pl.id = $1::uuid
        LIMIT 1`,
      [placementId],
    );
    return result.rows[0]?.status ? String(result.rows[0].status) : null;
  }

  async insertException(input: {
    priority: 'P0' | 'P1' | 'P2';
    kind: string;
    placement_id?: string | null;
    title: string;
    evidence_text: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO msos_exceptions (priority, kind, placement_id, title, evidence_text)
       VALUES ($1, $2, $3::uuid, $4, $5)`,
      [input.priority, input.kind, input.placement_id ?? null, input.title, input.evidence_text],
    );
  }
}

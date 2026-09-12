import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { calendarDayConflict } from './msos-capacity.util';
import { msosDisplayCode } from './msos-ids.util';
import type {
  CapacityBucketInput,
  CreateInventoryInput,
  CreatePackageInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  MsosCalendarDay,
  MsosInventoryRow,
  CreateIoInput,
  MsosBrandSafetySnapshotRow,
  CreateMediaLineInput,
  MsosInsertionOrderRow,
  MsosMediaLineRow,
  MsosPackageRow,
  MsosTrafficPackRow,
  UpsertTrafficInput,
  MsosPartnerRow,
  MsosPlacementRow,
  MsosRateCardRow,
  MsosRateVersionRow,
  MsosReservationRow,
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
    media_line_id?: string | null;
    title: string;
    evidence_text: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO msos_exceptions (priority, kind, placement_id, media_line_id, title, evidence_text)
       VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6)`,
      [
        input.priority,
        input.kind,
        input.placement_id ?? null,
        input.media_line_id ?? null,
        input.title,
        input.evidence_text,
      ],
    );
  }

  async listPackages(): Promise<MsosPackageRow[]> {
    const result = await this.db.query(
      `SELECT id::text, display_code, client_id::text, commercial_ref, sell_vnd,
              hide_buy_side, created_at::text, created_by
         FROM msos_packages
         ORDER BY created_at DESC`,
    );
    return result.rows as MsosPackageRow[];
  }

  async getPackage(packageId: string): Promise<MsosPackageRow | null> {
    const result = await this.db.query(
      `SELECT id::text, display_code, client_id::text, commercial_ref, sell_vnd,
              hide_buy_side, created_at::text, created_by
         FROM msos_packages
        WHERE id = $1::uuid
        LIMIT 1`,
      [packageId],
    );
    const row = result.rows[0] as MsosPackageRow | undefined;
    if (!row) return null;
    const lines = await this.db.query(
      `SELECT id::text, package_id::text, placement_id::text, rate_version_id::text,
              qty::bigint AS qty, period_start::text, period_end::text
         FROM msos_package_lines
        WHERE package_id = $1::uuid`,
      [packageId],
    );
    return { ...row, lines: lines.rows as MsosPackageRow['lines'] };
  }

  async getRateVersionById(rateVersionId: string): Promise<MsosRateVersionRow | null> {
    const result = await this.db.query(
      `SELECT id::text, rate_card_id::text, version, status, published_at::text, published_by,
              unit_price_vnd, currency
         FROM msos_rate_versions
        WHERE id = $1::uuid
        LIMIT 1`,
      [rateVersionId],
    );
    return (result.rows[0] as MsosRateVersionRow | undefined) ?? null;
  }

  async createPackage(input: CreatePackageInput): Promise<MsosPackageRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const displayCode = msosDisplayCode('PKG');
      const pkgResult = await client.query(
        `INSERT INTO msos_packages (display_code, client_id, commercial_ref, sell_vnd, hide_buy_side, created_by)
         VALUES ($1, $2::uuid, $3, $4, $5, $6)
         RETURNING id::text, display_code, client_id::text, commercial_ref, sell_vnd,
                   hide_buy_side, created_at::text, created_by`,
        [
          displayCode,
          input.client_id,
          input.commercial_ref ?? null,
          input.sell_vnd ?? 0,
          input.hide_buy_side ?? false,
          input.staffId ?? null,
        ],
      );
      const pkg = pkgResult.rows[0] as MsosPackageRow;
      const lines: MsosPackageRow['lines'] = [];
      for (const line of input.lines) {
        const lineResult = await client.query(
          `INSERT INTO msos_package_lines (package_id, placement_id, rate_version_id, qty, period_start, period_end)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::date, $6::date)
           RETURNING id::text, package_id::text, placement_id::text, rate_version_id::text,
                     qty::bigint AS qty, period_start::text, period_end::text`,
          [pkg.id, line.placement_id, line.rate_version_id, line.qty, line.period_start, line.period_end],
        );
        lines.push(lineResult.rows[0] as NonNullable<MsosPackageRow['lines']>[number]);
      }
      await client.query('COMMIT');
      return { ...pkg, lines };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getCapacityBucket(
    placementId: string,
    bucketDate: string,
  ): Promise<{ total: number; reserved_hard: number; reserved_soft: number } | null> {
    const result = await this.db.query(
      `SELECT total_qty::bigint AS total, reserved_hard::bigint AS reserved_hard,
              reserved_soft::bigint AS reserved_soft
         FROM msos_capacity_buckets
        WHERE placement_id = $1::uuid AND bucket_date = $2::date
        LIMIT 1`,
      [placementId, bucketDate],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      total: Number(row.total ?? 0),
      reserved_hard: Number(row.reserved_hard ?? 0),
      reserved_soft: Number(row.reserved_soft ?? 0),
    };
  }

  async incrementCapacityReserved(
    placementId: string,
    bucketDate: string,
    kind: 'soft' | 'hard',
    qty: number,
  ): Promise<void> {
    const col = kind === 'hard' ? 'reserved_hard' : 'reserved_soft';
    await this.db.query(
      `UPDATE msos_capacity_buckets
          SET ${col} = ${col} + $3
        WHERE placement_id = $1::uuid AND bucket_date = $2::date`,
      [placementId, bucketDate, qty],
    );
  }

  async insertReservation(input: {
    package_id: string;
    placement_id: string;
    bucket_date: string;
    kind: 'soft' | 'hard' | 'waitlist';
    qty: number;
    expires_at?: string | null;
  }): Promise<MsosReservationRow> {
    const result = await this.db.query(
      `INSERT INTO msos_reservations (package_id, placement_id, bucket_date, kind, qty, expires_at)
       VALUES ($1::uuid, $2::uuid, $3::date, $4, $5, $6::timestamptz)
       RETURNING id::text, package_id::text, placement_id::text, bucket_date::text, kind, qty::bigint AS qty,
                 expires_at::text, released_at::text, created_at::text`,
      [
        input.package_id,
        input.placement_id,
        input.bucket_date,
        input.kind,
        input.qty,
        input.expires_at ?? null,
      ],
    );
    return result.rows[0] as MsosReservationRow;
  }

  async hasValidReserve(packageId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1
         FROM msos_reservations
        WHERE package_id = $1::uuid
          AND kind IN ('hard', 'soft')
          AND released_at IS NULL
          AND (kind = 'hard' OR expires_at IS NULL OR expires_at > now())
        LIMIT 1`,
      [packageId],
    );
    return Boolean(result.rows[0]);
  }

  async createBrandSafetySnapshot(input: {
    tier: string;
    alcohol_pharma_banned?: boolean;
    exclusions_json?: unknown[];
  }): Promise<MsosBrandSafetySnapshotRow> {
    const result = await this.db.query(
      `INSERT INTO msos_brand_safety_snapshots (tier, alcohol_pharma_banned, exclusions_json)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id::text, tier, alcohol_pharma_banned, exclusions_json, locked_at::text`,
      [input.tier, input.alcohol_pharma_banned ?? true, JSON.stringify(input.exclusions_json ?? [])],
    );
    return result.rows[0] as MsosBrandSafetySnapshotRow;
  }

  async createInsertionOrder(
    packageId: string,
    input: CreateIoInput & { client_id: string; safety_snapshot_id: string; sell_vnd: number; buy_vnd: number },
  ): Promise<MsosInsertionOrderRow> {
    const displayCode = msosDisplayCode('IO');
    const result = await this.db.query(
      `INSERT INTO msos_insertion_orders (
         display_code, package_id, client_id, rate_version_id, safety_snapshot_id,
         period_start, period_end, qty, sell_vnd, buy_vnd
       ) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::date, $7::date, $8, $9, $10)
       RETURNING id::text, display_code, package_id::text, media_line_id::text, client_id::text,
                 rate_version_id::text, safety_snapshot_id::text, period_start::text, period_end::text,
                 qty::bigint AS qty, sell_vnd, buy_vnd, partner_confirmed_at::text, partner_confirm_ref,
                 issued_at::text, issued_by, status`,
      [
        displayCode,
        packageId,
        input.client_id,
        input.rate_version_id,
        input.safety_snapshot_id,
        input.period_start,
        input.period_end,
        input.qty,
        input.sell_vnd,
        input.buy_vnd,
      ],
    );
    return result.rows[0] as MsosInsertionOrderRow;
  }

  async getInsertionOrder(ioId: string): Promise<MsosInsertionOrderRow | null> {
    const result = await this.db.query(
      `SELECT id::text, display_code, package_id::text, media_line_id::text, client_id::text,
              rate_version_id::text, safety_snapshot_id::text, period_start::text, period_end::text,
              qty::bigint AS qty, sell_vnd, buy_vnd, partner_confirmed_at::text, partner_confirm_ref,
              issued_at::text, issued_by, status
         FROM msos_insertion_orders
        WHERE id = $1::uuid
        LIMIT 1`,
      [ioId],
    );
    return (result.rows[0] as MsosInsertionOrderRow | undefined) ?? null;
  }

  async issueInsertionOrder(ioId: string, issuedBy: number | null): Promise<MsosInsertionOrderRow> {
    const result = await this.db.query(
      `UPDATE msos_insertion_orders
          SET status = 'issued', issued_at = now(), issued_by = $2
        WHERE id = $1::uuid AND status = 'draft'
        RETURNING id::text, display_code, package_id::text, media_line_id::text, client_id::text,
                  rate_version_id::text, safety_snapshot_id::text, period_start::text, period_end::text,
                  qty::bigint AS qty, sell_vnd, buy_vnd, partner_confirmed_at::text, partner_confirm_ref,
                  issued_at::text, issued_by, status`,
      [ioId, issuedBy],
    );
    if (!result.rows[0]) {
      throw new Error('io_not_found_or_not_draft');
    }
    return result.rows[0] as MsosInsertionOrderRow;
  }

  async appendIoRevision(
    ioId: string,
    payload: unknown,
    createdBy: number | null,
  ): Promise<void> {
    const next = await this.db.query(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision
         FROM msos_io_revisions
        WHERE io_id = $1::uuid`,
      [ioId],
    );
    const revision = Number(next.rows[0]?.next_revision ?? 1);
    await this.db.query(
      `INSERT INTO msos_io_revisions (io_id, revision, payload_json, created_by)
       VALUES ($1::uuid, $2, $3::jsonb, $4)`,
      [ioId, revision, JSON.stringify(payload), createdBy],
    );
  }

  async updateIoSafetySnapshot(ioId: string, snapshotId: string): Promise<void> {
    await this.db.query(
      `UPDATE msos_insertion_orders SET safety_snapshot_id = $2::uuid WHERE id = $1::uuid`,
      [ioId, snapshotId],
    );
  }

  async listMediaLines(): Promise<MsosMediaLineRow[]> {
    const result = await this.db.query(
      `SELECT id::text, display_code, package_id::text, io_id::text, client_id::text,
              commercial_ref, connector_external_id, tracking_owner_staff_id, status,
              live_at::text, live_by, p03_override_by, p03_override_at::text, created_at::text
         FROM msos_media_lines
         ORDER BY created_at DESC`,
    );
    return result.rows as MsosMediaLineRow[];
  }

  async getMediaLine(lineId: string): Promise<MsosMediaLineRow | null> {
    const result = await this.db.query(
      `SELECT id::text, display_code, package_id::text, io_id::text, client_id::text,
              commercial_ref, connector_external_id, tracking_owner_staff_id, status,
              live_at::text, live_by, p03_override_by, p03_override_at::text, created_at::text
         FROM msos_media_lines
        WHERE id = $1::uuid
        LIMIT 1`,
      [lineId],
    );
    return (result.rows[0] as MsosMediaLineRow | undefined) ?? null;
  }

  async createMediaLine(input: CreateMediaLineInput & { client_id: string }): Promise<MsosMediaLineRow> {
    const displayCode = msosDisplayCode('ML');
    const result = await this.db.query(
      `INSERT INTO msos_media_lines (
         display_code, package_id, io_id, client_id, commercial_ref,
         connector_external_id, tracking_owner_staff_id
       ) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)
       RETURNING id::text, display_code, package_id::text, io_id::text, client_id::text,
                 commercial_ref, connector_external_id, tracking_owner_staff_id, status,
                 live_at::text, live_by, p03_override_by, p03_override_at::text, created_at::text`,
      [
        displayCode,
        input.package_id,
        input.io_id ?? null,
        input.client_id,
        input.commercial_ref ?? null,
        input.connector_external_id ?? null,
        input.tracking_owner_staff_id ?? null,
      ],
    );
    return result.rows[0] as MsosMediaLineRow;
  }

  async setMediaLineLive(lineId: string, staffId: number | null): Promise<MsosMediaLineRow> {
    const result = await this.db.query(
      `UPDATE msos_media_lines
          SET status = 'live', live_at = now(), live_by = $2
        WHERE id = $1::uuid
        RETURNING id::text, display_code, package_id::text, io_id::text, client_id::text,
                  commercial_ref, connector_external_id, tracking_owner_staff_id, status,
                  live_at::text, live_by, p03_override_by, p03_override_at::text, created_at::text`,
      [lineId, staffId],
    );
    return result.rows[0] as MsosMediaLineRow;
  }

  async setP03Override(lineId: string, staffId: number | null): Promise<MsosMediaLineRow> {
    const result = await this.db.query(
      `UPDATE msos_media_lines
          SET p03_override_by = $2, p03_override_at = now()
        WHERE id = $1::uuid
        RETURNING id::text, display_code, package_id::text, io_id::text, client_id::text,
                  commercial_ref, connector_external_id, tracking_owner_staff_id, status,
                  live_at::text, live_by, p03_override_by, p03_override_at::text, created_at::text`,
      [lineId, staffId],
    );
    return result.rows[0] as MsosMediaLineRow;
  }

  async getTrafficPack(mediaLineId: string): Promise<MsosTrafficPackRow | null> {
    const result = await this.db.query(
      `SELECT id::text, display_code, media_line_id::text, creative_id::text, width_px, height_px,
              weight_kb, click_url, backup_attached, status, reject_reason, updated_at::text
         FROM msos_traffic_packs
        WHERE media_line_id = $1::uuid
        ORDER BY updated_at DESC
        LIMIT 1`,
      [mediaLineId],
    );
    return (result.rows[0] as MsosTrafficPackRow | undefined) ?? null;
  }

  async upsertTrafficPack(mediaLineId: string, input: UpsertTrafficInput): Promise<MsosTrafficPackRow> {
    const existing = await this.getTrafficPack(mediaLineId);
    if (existing) {
      const result = await this.db.query(
        `UPDATE msos_traffic_packs
            SET creative_id = COALESCE($2::uuid, creative_id),
                width_px = COALESCE($3, width_px),
                height_px = COALESCE($4, height_px),
                weight_kb = COALESCE($5, weight_kb),
                click_url = COALESCE($6, click_url),
                backup_attached = COALESCE($7, backup_attached),
                updated_at = now()
          WHERE id = $1::uuid
          RETURNING id::text, display_code, media_line_id::text, creative_id::text, width_px, height_px,
                    weight_kb, click_url, backup_attached, status, reject_reason, updated_at::text`,
        [
          existing.id,
          input.creative_id ?? null,
          input.width_px ?? null,
          input.height_px ?? null,
          input.weight_kb ?? null,
          input.click_url ?? null,
          input.backup_attached ?? null,
        ],
      );
      return result.rows[0] as MsosTrafficPackRow;
    }
    const displayCode = msosDisplayCode('TP');
    const result = await this.db.query(
      `INSERT INTO msos_traffic_packs (
         display_code, media_line_id, creative_id, width_px, height_px, weight_kb, click_url, backup_attached
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
       RETURNING id::text, display_code, media_line_id::text, creative_id::text, width_px, height_px,
                 weight_kb, click_url, backup_attached, status, reject_reason, updated_at::text`,
      [
        displayCode,
        mediaLineId,
        input.creative_id ?? null,
        input.width_px ?? null,
        input.height_px ?? null,
        input.weight_kb ?? null,
        input.click_url ?? null,
        input.backup_attached ?? false,
      ],
    );
    return result.rows[0] as MsosTrafficPackRow;
  }

  async submitTrafficPack(mediaLineId: string): Promise<MsosTrafficPackRow> {
    const existing = await this.getTrafficPack(mediaLineId);
    if (!existing) {
      throw new Error('traffic_pack_not_found');
    }
    const result = await this.db.query(
      `UPDATE msos_traffic_packs
          SET status = 'submitted', updated_at = now()
        WHERE id = $1::uuid
        RETURNING id::text, display_code, media_line_id::text, creative_id::text, width_px, height_px,
                  weight_kb, click_url, backup_attached, status, reject_reason, updated_at::text`,
      [existing.id],
    );
    return result.rows[0] as MsosTrafficPackRow;
  }

  async getPlacementForLine(lineId: string): Promise<{
    backup_required: boolean;
    max_weight_kb: number | null;
  } | null> {
    const result = await this.db.query(
      `SELECT pl.backup_required, pl.max_weight_kb
         FROM msos_media_lines ml
         JOIN msos_package_lines pln ON pln.package_id = ml.package_id
         JOIN msos_placements pl ON pl.id = pln.placement_id
        WHERE ml.id = $1::uuid
        LIMIT 1`,
      [lineId],
    );
    return (result.rows[0] as { backup_required: boolean; max_weight_kb: number | null } | undefined) ?? null;
  }
}

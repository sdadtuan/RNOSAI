import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { msosDisplayCode } from './msos-ids.util';
import type {
  CreateInventoryInput,
  CreatePartnerInput,
  CreatePlacementInput,
  MsosInventoryRow,
  MsosPartnerRow,
  MsosPlacementRow,
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
}

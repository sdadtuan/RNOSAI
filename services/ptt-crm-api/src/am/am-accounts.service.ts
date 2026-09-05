import { Inject, Injectable, OnModuleDestroy, Optional, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { AgencyService } from '../agency/agency.service';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';

export type AmCreateAccountBody =
  | { mode: 'create'; code: string; name: string; industry_slug?: string; owner_am_id?: string }
  | { mode: 'attach'; agency_client_id: string; owner_staff_id?: number };

export type AmAccountActor = {
  staffId: number;
  caps: StaffSectionCap[];
  via?: 'internal' | 'jwt';
};

export type AmAccountsDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const EXT_UPSERT = `
INSERT INTO crm_am_account_ext (
  agency_client_id, tenant_id, account_owner_staff_id, am_status, updated_at
) VALUES ($1::uuid, $2, $3, 'active', now())
ON CONFLICT (agency_client_id) DO UPDATE SET
  -- first-writer-wins: keep existing owner; only set when current is null
  account_owner_staff_id = COALESCE(crm_am_account_ext.account_owner_staff_id, EXCLUDED.account_owner_staff_id),
  updated_at = now()
`;

@Injectable()
export class AmAccountsRepository implements OnModuleDestroy, AmAccountsDb {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> {
    return this.db.query(sql, params);
  }
}

@Injectable()
export class AmAccountsService {
  constructor(
    @Inject(forwardRef(() => AgencyService)) private readonly agency: AgencyService,
    private readonly db: AmAccountsRepository,
    private readonly staffAuth: StaffAuthService,
    @Optional() private readonly dashboard?: AmDashboardService,
  ) {}

  async createAccount(body: AmCreateAccountBody, actor: AmAccountActor) {
    if (body.mode === 'create') {
      return this.createFromAgency(body, actor);
    }
    if (body.mode === 'attach') {
      return this.attachExisting(body, actor);
    }
    amThrow(400, { error: 'invalid_mode' });
  }

  private canAgencyWrite(actor: AmAccountActor): boolean {
    if (actor.via === 'internal') return true;
    return (
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_agency', 'create') ||
      this.staffAuth.hasCap(actor.caps ?? [], 'crm_agency', 'write')
    );
  }

  private async createFromAgency(
    body: Extract<AmCreateAccountBody, { mode: 'create' }>,
    actor: AmAccountActor,
  ) {
    if (!this.canAgencyWrite(actor)) {
      amThrow(403, { error: 'agency_write_required', fallback: '/agency/clients/new' });
    }
    const client = await this.agency.createClient({
      code: body.code,
      name: body.name,
      industry_slug: body.industry_slug,
      owner_am_id: body.owner_am_id,
    });
    await this.upsertExt(client.id, actor.staffId);
    this.dashboard?.dropCache();
    return { agency_client_id: client.id, mode: 'create' as const, client };
  }

  private async attachExisting(
    body: Extract<AmCreateAccountBody, { mode: 'attach' }>,
    actor: AmAccountActor,
  ) {
    const agencyClientId = String(body.agency_client_id ?? '').trim();
    if (!agencyClientId) {
      amThrow(400, { error: 'agency_client_id_required' });
    }
    const found = await this.db.query(`SELECT id::text FROM clients WHERE id::text = $1 LIMIT 1`, [
      agencyClientId,
    ]);
    if ((found.rowCount ?? found.rows.length) === 0) {
      amThrow(404, { error: 'client_not_found' });
    }
    const ownerStaffId = body.owner_staff_id ?? actor.staffId;
    await this.upsertExt(agencyClientId, ownerStaffId);
    this.dashboard?.dropCache();
    return { agency_client_id: agencyClientId, mode: 'attach' as const };
  }

  private async upsertExt(agencyClientId: string, ownerStaffId: number): Promise<void> {
    await this.db.query(EXT_UPSERT, [
      agencyClientId,
      AM_TENANT_ID,
      ownerStaffId > 0 ? ownerStaffId : null,
    ]);
  }
}

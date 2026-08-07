import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService, StaffStubUser } from '../config/app-config.service';
import { StaffJobFunctionsRepository } from '../staff-permissions/staff-job-functions.repository';
import { StaffBreakGlassRepository } from '../staff-break-glass/staff-break-glass.repository';
import { StaffPermissionSetsRepository } from '../staff-permission-sets/staff-permission-sets.repository';
import { StaffUserClientsRepository } from '../staff-client-scope/staff-user-clients.repository';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';
import { verifyPortalPassword } from '../portal/portal-password.util';
import {
  StaffLoginResult,
  StaffMeResponse,
  StaffRosterResponse,
  StaffRosterRow,
  StaffSectionCap,
  StaffUserProfile,
} from './staff-auth.types';
import { signStaffJwt, StaffJwtPayload, verifyStaffJwt } from './staff-jwt.util';
import { parseNumericStaffSub } from './staff-user-id.util';

const DEFAULT_STUB_CAPS: StaffSectionCap[] = [
  { section: 'dashboard', action: 'view' },
  { section: 'crm_leads', action: 'view' },
  { section: 'crm_leads', action: 'edit' },
  { section: 'crm_leads', action: 'assign' },
  { section: 'crm_presales_solution', action: 'view' },
  { section: 'crm_presales_solution', action: 'edit' },
  { section: 'crm_presales_solution', action: 'claim' },
  { section: 'crm_presales_solution', action: 'release' },
  { section: 'crm_board_customers', action: 'view' },
  { section: 'crm_board_customers', action: 'edit' },
  { section: 'crm_board_customers', action: 'create' },
  { section: 'crm_board', action: 'view' },
  { section: 'crm_board', action: 'edit' },
  { section: 'crm_sales_overview', action: 'view' },
  { section: 'crm_sales_plans', action: 'view' },
  { section: 'crm_sales_plans', action: 'create' },
  { section: 'crm_sales_funnel', action: 'view' },
  { section: 'crm_sales_training', action: 'view' },
  { section: 'crm_sales_training', action: 'create' },
  { section: 'crm_sales_market', action: 'view' },
  { section: 'crm_sales_market', action: 'create' },
  { section: 'crm_sales_prospects', action: 'view' },
  { section: 'crm_sales_prospects', action: 'create' },
  { section: 'crm_payroll_attendance', action: 'view' },
  { section: 'crm_payroll_salary', action: 'view' },
  { section: 'crm_payroll_salary', action: 'edit' },
  { section: 'crm_payroll_salary', action: 'export' },
  { section: 'crm_business_dashboard', action: 'view' },
  { section: 'crm_business_dashboard', action: 'export' },
  { section: 'crm_business_dashboard', action: 'configure' },
  { section: 'ai_analytics', action: 'query' },
  { section: 'ai_forecast', action: 'commit' },
  { section: 'crm_owner_weekly_dashboard', action: 'view' },
  { section: 'crm_owner_weekly_dashboard', action: 'export' },
  { section: 'crm_owner_weekly_dashboard', action: 'configure' },
  { section: 'crm_data_config', action: 'view' },
  { section: 'crm_data_config', action: 'configure' },
  { section: 'ai_admin', action: 'view' },
  { section: 'automation_workflows', action: 'view' },
  { section: 'automation_workflows', action: 'configure' },
  { section: 'automation_workflows', action: 'simulate' },
  { section: 'crm_search', action: 'view' },
  { section: 'crm_search', action: 'configure' },
  { section: 'playbooks', action: 'view' },
  { section: 'playbooks', action: 'configure' },
  { section: 'crm_re_projects', action: 'view' },
  { section: 'crm_re_projects', action: 'create' },
  { section: 'crm_re_projects', action: 'edit' },
  { section: 'crm_re_projects', action: 'delete' },
  { section: 'crm_re_projects', action: 'export' },
  { section: 'crm_re_projects_products', action: 'view' },
  { section: 'crm_re_projects_products', action: 'create' },
  { section: 'crm_re_projects_products', action: 'edit' },
  { section: 'crm_re_projects_products', action: 'delete' },
  { section: 'crm_re_projects_budget', action: 'view' },
  { section: 'crm_re_projects_budget', action: 'create' },
  { section: 'crm_re_projects_budget', action: 'edit' },
  { section: 'crm_re_projects_budget', action: 'delete' },
  { section: 'crm_re_projects_budget', action: 'export' },
  { section: 'crm_re_projects_kpi', action: 'view' },
  { section: 'crm_re_projects_kpi', action: 'create' },
  { section: 'crm_re_projects_kpi', action: 'edit' },
  { section: 'crm_re_projects_kpi', action: 'delete' },
  { section: 'crm_re_projects_risks', action: 'view' },
  { section: 'crm_re_projects_risks', action: 'create' },
  { section: 'crm_re_projects_risks', action: 'edit' },
  { section: 'crm_re_projects_risks', action: 'delete' },
  { section: 'crm_staff_roster', action: 'view' },
  { section: 'crm_staff_roster', action: 'edit' },
  { section: 'crm_kpi_records', action: 'view' },
  { section: 'crm_kpi_records', action: 'edit' },
  { section: 'crm_staff_kpi_am_sp', action: 'view' },
  { section: 'crm_agency', action: 'view' },
  { section: 'crm_agency', action: 'create' },
  { section: 'crm_facebook_ads', action: 'view' },
  { section: 'crm_google_ads', action: 'view' },
  { section: 'crm_google_ads', action: 'export' },
  { section: 'crm_zalo_ads', action: 'view' },
  { section: 'crm_zalo_ads', action: 'export' },
  { section: 'meta_campaign_write', action: 'view' },
  { section: 'meta_campaign_write', action: 'approve' },
  { section: 'crm_seo', action: 'view' },
  { section: 'crm_seo_aeo', action: 'view' },
  { section: 'crm_seo_aeo', action: 'edit' },
  { section: 'crm_seo_aeo_write', action: 'view' },
  { section: 'crm_seo_aeo_write', action: 'edit' },
  { section: 'crm_seo_aeo_write', action: 'create' },
  { section: 'crm_seo_aeo_settings', action: 'view' },
  { section: 'crm_seo_aeo_settings', action: 'configure' },
  { section: 'crm_seo_aeo_settings', action: 'edit' },
  { section: 'crm_seo_aeo_approve', action: 'view' },
  { section: 'crm_seo_aeo_approve', action: 'approve' },
  { section: 'crm_seo_aeo_technical', action: 'view' },
  { section: 'crm_seo_aeo_technical', action: 'edit' },
  { section: 'crm_seo_aeo_reports', action: 'view' },
  { section: 'crm_seo_aeo_reports', action: 'export' },
  { section: 'crm_email_mkt', action: 'view' },
  { section: 'crm_email_mkt', action: 'write' },
  { section: 'crm_email_mkt', action: 'settings' },
  { section: 'crm_email_mkt', action: 'compliance' },
  { section: 'crm_email_mkt', action: 'approve' },
  { section: 'crm_email_mkt', action: 'deliverability' },
  { section: 'crm_email_mkt', action: 'reports' },
];

@Injectable()
export class StaffAuthService {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => StaffJobFunctionsRepository))
    private readonly jobFunctions: StaffJobFunctionsRepository,
    @Inject(forwardRef(() => StaffPermissionSetsRepository))
    private readonly permissionSets: StaffPermissionSetsRepository,
    @Inject(forwardRef(() => StaffBreakGlassRepository))
    private readonly breakGlass: StaffBreakGlassRepository,
    @Inject(forwardRef(() => StaffUserClientsRepository))
    private readonly userClients: StaffUserClientsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  /** Map staff JWT (UUID sub) to numeric crm_staff.id for PG bigint columns. */
  async resolveCrmStaffUserId(payload: StaffJwtPayload | undefined): Promise<number | null> {
    if (!payload?.sub) return null;
    const numeric = parseNumericStaffSub(payload.sub);
    if (numeric != null) return numeric;
    const email = payload.email?.trim();
    if (!email) return null;
    try {
      const result = await this.db.query(
        `SELECT id FROM crm_staff
         WHERE active = TRUE AND lower(trim(email)) = lower(trim($1))
         LIMIT 1`,
        [email],
      );
      const id = result.rows[0]?.id;
      return id != null ? Number(id) : null;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<StaffLoginResult> {
    const normalized = email.trim().toLowerCase();
    const user = await this.resolveUser(normalized, password);
    if (!user) {
      throw new UnauthorizedException({ error: 'Invalid credentials' });
    }
    return this.issueTokens(user);
  }

  refresh(refreshToken: string): Promise<StaffLoginResult> {
    const payload = verifyStaffJwt(refreshToken, this.config.staffJwtSecret);
    if (!payload || payload.token_type !== 'refresh') {
      throw new UnauthorizedException({ error: 'Invalid or expired refresh token' });
    }
    return this.issueTokens({
      id: payload.sub,
      email: payload.email,
      displayName: payload.display_name,
      positionId: payload.position_id,
    });
  }

  verifyAccessToken(token: string): StaffJwtPayload {
    const payload = verifyStaffJwt(token, this.config.staffJwtSecret);
    if (!payload || payload.token_type !== 'access') {
      throw new UnauthorizedException({ error: 'Invalid or expired token' });
    }
    return payload;
  }

  async me(accessPayload: StaffJwtPayload): Promise<StaffMeResponse> {
    const baseCaps = await this.loadCaps(accessPayload.position_id);
    const jobFunctions = await this.jobFunctions.loadUserFunctionCodes(accessPayload.sub);
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(jobFunctions);
    const setCaps = await this.permissionSets.loadCapsForUser(accessPayload.sub);
    const breakGlassCaps = await this.breakGlass.loadActiveCapsForUser(accessPayload.sub);
    const caps = this.mergeCaps(baseCaps, [
      ...functionCaps,
      ...setCaps,
      ...breakGlassCaps.map((cap) => ({ section_id: cap.section, action: cap.action })),
    ]);
    const permission_sets = await this.permissionSets.loadUserSetCodes(accessPayload.sub);
    const position_code = await this.loadPositionCode(accessPayload.position_id);
    const client_ids = await this.resolveJwtClientIds(accessPayload.sub, position_code);
    return {
      id: accessPayload.sub,
      email: accessPayload.email,
      display_name: accessPayload.display_name,
      position_id: accessPayload.position_id,
      position_code: position_code ?? undefined,
      job_functions: jobFunctions.length ? jobFunctions : undefined,
      permission_sets: permission_sets.length ? permission_sets : undefined,
      client_ids,
      caps,
    };
  }

  isSuperAdminPosition(positionCode: string | null | undefined): boolean {
    return isSuperAdminPositionCode(positionCode);
  }

  async loadPositionCodePublic(positionId: number): Promise<string | null> {
    return this.loadPositionCode(positionId);
  }

  private async resolveJwtClientIds(
    userId: string,
    positionCode: string | null,
  ): Promise<string[] | undefined> {
    if (!this.config.staffScopePilotEnabled) return undefined;
    if (isSuperAdminPositionCode(positionCode)) return undefined;
    const ids = await this.userClients.loadClientIdsForUser(userId);
    return ids.length ? ids : undefined;
  }

  async listActiveStaff(): Promise<StaffRosterResponse> {
    const staff: StaffRosterRow[] = [];
    if (this.config.staffAllowStubUsers) {
      for (const stub of this.config.staffStubUsers) {
        staff.push({
          id: stub.staffId,
          email: stub.email,
          display_name: stub.displayName || stub.email,
          position_id: stub.positionId,
        });
      }
    }
    try {
      const result = await this.db.query(
        `SELECT id::text, email, display_name, position_id
         FROM staff_users
         WHERE active IS TRUE
         ORDER BY display_name, email`,
      );
      for (const row of result.rows) {
        staff.push({
          id: String(row.id),
          email: String(row.email),
          display_name: String(row.display_name || row.email),
          position_id: Number(row.position_id),
        });
      }
    } catch {
      /* staff_users may not exist on fresh dev */
    }
    const seen = new Set<string>();
    const deduped = staff.filter((row) => {
      const key = row.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) =>
      (a.display_name || a.email).localeCompare(b.display_name || b.email, 'vi'),
    );
    return { staff: deduped };
  }

  hasCap(caps: StaffSectionCap[], section: string, action: string): boolean {
    return caps.some((c) => c.section === section && c.action === action);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    displayName: string;
    positionId: number;
  }): Promise<StaffLoginResult> {
    const position_code = await this.loadPositionCode(user.positionId);
    const client_ids = await this.resolveJwtClientIds(user.id, position_code);
    const base = {
      sub: user.id,
      email: user.email,
      display_name: user.displayName,
      position_id: user.positionId,
      ...(client_ids?.length ? { client_ids } : {}),
    };
    const accessToken = signStaffJwt(
      { ...base, token_type: 'access' },
      this.config.staffJwtSecret,
      this.config.staffJwtTtlSec,
    );
    const refreshToken = signStaffJwt(
      { ...base, token_type: 'refresh' },
      this.config.staffJwtSecret,
      this.config.staffRefreshTtlSec,
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.config.staffJwtTtlSec,
      refresh_expires_in: this.config.staffRefreshTtlSec,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        position_id: user.positionId,
        position_code: position_code ?? undefined,
        client_ids,
      },
    };
  }

  async hasCapForPosition(positionId: number, section: string, action: string): Promise<boolean> {
    const caps = await this.loadCaps(positionId);
    return this.hasCap(caps, section, action);
  }

  private async resolveUser(
    email: string,
    password: string,
  ): Promise<(StaffUserProfile & { displayName: string; positionId: number }) | null> {
    if (this.config.staffAllowStubUsers) {
      const stub = this.config.staffStubUsers.find(
        (u) => u.email === email && u.password === password,
      );
      if (stub) {
        return {
          id: stub.staffId,
          email: stub.email,
          display_name: stub.displayName,
          displayName: stub.displayName,
          position_id: stub.positionId,
          positionId: stub.positionId,
        };
      }
    }
    try {
      const result = await this.db.query(
        `SELECT id::text, email, password_hash, display_name, position_id
         FROM staff_users
         WHERE LOWER(email) = $1 AND active IS TRUE
         LIMIT 1`,
        [email],
      );
      const row = result.rows[0] as
        | {
            id: string;
            email: string;
            password_hash: string;
            display_name: string;
            position_id: number;
          }
        | undefined;
      if (!row || !verifyPortalPassword(password, row.password_hash)) {
        return null;
      }
      void this.db.query(`UPDATE staff_users SET last_login_at = NOW() WHERE id = $1::uuid`, [
        row.id,
      ]);
      return {
        id: row.id,
        email: row.email,
        display_name: row.display_name || row.email,
        displayName: row.display_name || row.email,
        position_id: row.position_id,
        positionId: row.position_id,
      };
    } catch {
      return null;
    }
  }

  private mergeCaps(base: StaffSectionCap[], extra: Array<{ section_id: string; action: string }>): StaffSectionCap[] {
    const map = new Map<string, StaffSectionCap>();
    for (const cap of base) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const cap of extra) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    return [...map.values()].sort((a, b) =>
      `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'),
    );
  }

  private async loadPositionCode(positionId: number): Promise<string | null> {
    try {
      const result = await this.db.query<{ code: string }>(
        `SELECT code FROM crm_positions WHERE id = $1 LIMIT 1`,
        [positionId],
      );
      return result.rows[0]?.code ? String(result.rows[0].code) : null;
    } catch {
      return null;
    }
  }

  async loadCaps(positionId: number): Promise<StaffSectionCap[]> {
    try {
      const result = await this.db.query(
        `SELECT section_id, action
         FROM staff_section_permissions
         WHERE position_id = $1
         ORDER BY section_id, action`,
        [positionId],
      );
      if (result.rowCount && result.rowCount > 0) {
        return result.rows.map((row) => ({
          section: String(row.section_id),
          action: String(row.action),
        }));
      }
    } catch {
      // table may not exist yet on fresh dev
    }
    return DEFAULT_STUB_CAPS;
  }
}

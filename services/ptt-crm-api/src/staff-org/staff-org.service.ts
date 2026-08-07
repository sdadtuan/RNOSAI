import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJobFunctionsRepository } from '../staff-permissions/staff-job-functions.repository';
import { JOB_FUNCTION_CATALOG } from '../staff-permissions/staff-job-functions.catalog';
import {
  normalizeFunctionCodes,
  validateJobFunctionAssignment,
} from './staff-org.sod.util';
import { StaffOrgRepository } from './staff-org.repository';
import type {
  CreateStaffDepartmentBody,
  CreateStaffTeamBody,
  PatchStaffDepartmentBody,
  PatchStaffOrgPositionBody,
  PatchStaffTeamBody,
  PutStaffUserJobFunctionsBody,
  StaffOrgUserSummary,
  StaffUserEffectiveCapsResponse,
  StaffUserJobFunctionsResponse,
} from './staff-org.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResolvedUser = {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
};

@Injectable()
export class StaffOrgService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private orgRepo: StaffOrgRepository | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly jobFunctions: StaffJobFunctionsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private get repository(): StaffOrgRepository {
    if (!this.orgRepo) {
      this.orgRepo = new StaffOrgRepository(this.db);
    }
    return this.orgRepo;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.orgRepo = null;
  }

  listDepartments() {
    return this.repository.listDepartments();
  }

  createDepartment(body: CreateStaffDepartmentBody, actorEmail: string) {
    return this.repository.createDepartment(body, actorEmail);
  }

  patchDepartment(id: number, body: PatchStaffDepartmentBody, actorEmail: string) {
    return this.repository.patchDepartment(id, body, actorEmail);
  }

  listTeams(departmentId?: number) {
    return this.repository.listTeams(departmentId);
  }

  createTeam(body: CreateStaffTeamBody, actorEmail: string) {
    return this.repository.createTeam(body, actorEmail);
  }

  patchTeam(id: number, body: PatchStaffTeamBody, actorEmail: string) {
    return this.repository.patchTeam(id, body, actorEmail);
  }

  listPositions() {
    return this.repository.listPositions();
  }

  patchPosition(id: number, body: PatchStaffOrgPositionBody, actorEmail: string) {
    return this.repository.patchPosition(id, body, actorEmail);
  }

  listJobFunctionCatalog() {
    return JOB_FUNCTION_CATALOG.map((fn) => ({
      code: fn.code,
      label: fn.label,
      description: fn.description,
      department_scope: fn.department_scope,
    }));
  }

  async listUsers(): Promise<StaffOrgUserSummary[]> {
    try {
      const result = await this.db.query<{
        id: string;
        email: string;
        display_name: string;
        position_id: number;
        position_code: string | null;
      }>(
        `SELECT u.id::text, u.email, u.display_name, u.position_id, p.code AS position_code
         FROM staff_users u
         LEFT JOIN crm_positions p ON p.id = u.position_id
         WHERE u.active IS TRUE
         ORDER BY u.display_name, u.email`,
      );
      const rows: StaffOrgUserSummary[] = [];
      for (const row of result.rows) {
        const functions = await this.jobFunctions.loadUserFunctionCodes(String(row.id));
        rows.push({
          id: String(row.id),
          email: String(row.email),
          display_name: String(row.display_name || row.email),
          position_id: Number(row.position_id),
          position_code: row.position_code ? String(row.position_code) : undefined,
          job_functions: functions,
        });
      }
      return rows;
    } catch {
      const roster = await this.staffAuth.listActiveStaff();
      const rows: StaffOrgUserSummary[] = [];
      for (const row of roster.staff) {
        const functions = await this.jobFunctions.loadUserFunctionCodes(row.id);
        rows.push({
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          position_id: row.position_id,
          job_functions: functions,
        });
      }
      return rows;
    }
  }

  async getUserJobFunctions(userRef: string): Promise<StaffUserJobFunctionsResponse> {
    const user = await this.resolveUser(userRef);
    const functions = await this.jobFunctions.loadUserFunctionCodes(user.id);
    return {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      position_id: user.position_id,
      position_code: user.position_code,
      functions,
    };
  }

  async putUserJobFunctions(
    userRef: string,
    body: PutStaffUserJobFunctionsBody,
    actorEmail: string,
  ): Promise<StaffUserJobFunctionsResponse> {
    const user = await this.resolveUser(userRef);
    const functions = normalizeFunctionCodes(body.functions ?? []);
    const sod = validateJobFunctionAssignment(functions);
    if (sod) {
      throw new ConflictException({ error: 'sod_violation', sod_id: sod.id, message: sod.message });
    }
    await this.jobFunctions.replaceUserFunctions(user.id, functions, actorEmail);
    return this.getUserJobFunctions(user.id);
  }

  async getEffectiveCaps(userRef: string): Promise<StaffUserEffectiveCapsResponse> {
    const user = await this.resolveUser(userRef);
    const job_functions = await this.jobFunctions.loadUserFunctionCodes(user.id);
    const baseCaps = await this.staffAuth.loadCaps(user.position_id);
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(job_functions);
    const map = new Map<string, { section: string; action: string }>();
    for (const cap of baseCaps) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const cap of functionCaps) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    return {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      position_id: user.position_id,
      position_code: user.position_code,
      job_functions,
      caps: [...map.values()].sort((a, b) =>
        `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'),
      ),
    };
  }

  private async resolveUser(userRef: string): Promise<ResolvedUser> {
    const ref = userRef.trim();
    if (!ref) throw new NotFoundException({ error: 'user_not_found' });

    if (UUID_RE.test(ref)) {
      const byUuid = await this.loadStaffUser(`u.id = $1::uuid`, [ref]);
      if (byUuid) return byUuid;
    }

    const numeric = Number(ref);
    if (Number.isFinite(numeric) && numeric > 0) {
      const byCrm = await this.resolveFromCrmStaffId(numeric);
      if (byCrm) return byCrm;
    }

    const byEmail = await this.loadStaffUser(`lower(trim(u.email)) = lower(trim($1))`, [ref]);
    if (byEmail) return byEmail;

    throw new NotFoundException({ error: 'user_not_found', ref });
  }

  private async resolveFromCrmStaffId(crmStaffId: number): Promise<ResolvedUser | null> {
    try {
      const crm = await this.db.query<{ email: string | null }>(
        `SELECT email FROM crm_staff WHERE id = $1 AND active = TRUE LIMIT 1`,
        [crmStaffId],
      );
      const email = crm.rows[0]?.email ? String(crm.rows[0].email).trim() : '';
      if (!email) return null;
      return this.loadStaffUser(`lower(trim(u.email)) = lower(trim($1))`, [email]);
    } catch {
      return null;
    }
  }

  private async loadStaffUser(whereSql: string, params: unknown[]): Promise<ResolvedUser | null> {
    try {
      const result = await this.db.query<{
        id: string;
        email: string;
        display_name: string;
        position_id: number;
        position_code: string | null;
      }>(
        `SELECT u.id::text, u.email, u.display_name, u.position_id, p.code AS position_code
         FROM staff_users u
         LEFT JOIN crm_positions p ON p.id = u.position_id
         WHERE ${whereSql}
         LIMIT 1`,
        params,
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        email: String(row.email),
        display_name: String(row.display_name || row.email),
        position_id: Number(row.position_id),
        position_code: row.position_code ? String(row.position_code) : undefined,
      };
    } catch {
      return null;
    }
  }
}

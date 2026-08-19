import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import type {
  HrStaffProfileResponse,
  PatchHrStaffIdentityBody,
  PutHrStaffAddressesBody,
} from './hr-employee-file.types';
import {
  bodyContainsPiiFields,
  computeProfileCompleteness,
  maskIdentityForApi,
} from './hr-employee-file.util';

@Injectable()
export class HrEmployeeFileService {
  constructor(
    private readonly repo: HrEmployeeFileRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async ensureReady(): Promise<void> {
    if (!(await this.repo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_employee_file_not_ready' });
    }
  }

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async capsFor(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    return {
      me,
      canViewPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view'),
      canEditPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit'),
      canEditRoster: this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
    };
  }

  async getProfile(
    payload: StaffJwtPayload | undefined,
    staffId: number,
  ): Promise<HrStaffProfileResponse> {
    this.requireUser(payload);
    await this.ensureReady();
    const staff = await this.repo.assertStaffExists(staffId);
    const { canViewPii, canEditPii, canEditRoster } = await this.capsFor(payload!);
    const identityRow = await this.repo.getIdentity(staffId);
    const addresses = await this.repo.listAddresses(staffId);
    const identity = maskIdentityForApi(identityRow, canViewPii);
    return {
      ok: true,
      staff,
      identity,
      addresses,
      completeness_pct: computeProfileCompleteness(identityRow, addresses),
      can_view_pii: canViewPii,
      can_edit_pii: canEditPii,
      can_edit_roster: canEditRoster,
    };
  }

  async patchIdentity(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: PatchHrStaffIdentityBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.repo.assertStaffExists(staffId);
    const { canEditPii, canEditRoster } = await this.capsFor(user);
    if (!canEditRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    if (bodyContainsPiiFields(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }

    const row = await this.repo.upsertIdentity(staffId, body);
    if (bodyContainsPiiFields(body as Record<string, unknown>)) {
      await this.repo.logPiiAudit({
        staffId,
        actorUserId: user.sub,
        actorEmail: user.email ?? '',
        action: 'patch_identity_pii',
        section: 'identity',
        meta: { fields: Object.keys(body).filter((k) =>
          ['cccd', 'tax_code', 'bank_name', 'bank_account', 'bank_holder'].includes(k),
        ) },
      });
    }

    const { canViewPii } = await this.capsFor(user);
    const addresses = await this.repo.listAddresses(staffId);
    return {
      ok: true,
      identity: maskIdentityForApi(row, canViewPii),
      completeness_pct: computeProfileCompleteness(row, addresses),
    };
  }

  async putAddresses(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: PutHrStaffAddressesBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.repo.assertStaffExists(staffId);
    const { canEditRoster } = await this.capsFor(user);
    if (!canEditRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    const addresses = body.addresses ?? [];
    if (!addresses.length) {
      throw new NotFoundException({ error: 'addresses_required' });
    }
    const rows = await this.repo.putAddresses(staffId, addresses);
    const identityRow = await this.repo.getIdentity(staffId);
    return {
      ok: true,
      addresses: rows,
      completeness_pct: computeProfileCompleteness(identityRow, rows),
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CsdAuditRepository } from './csd-audit.repository';
import { CsdChatAccountsRepository } from './csd-chat-accounts.repository';
import type {
  CsdActor,
  CsdChatAccountAdminRow,
  CsdChatAccountRow,
  CsdChatMe,
  CsdChatPersonRow,
  CsdChatStaffDirectoryRow,
} from './csd.types';

function hasCsdCap(actor: CsdActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'csd' && c.action === action);
}

@Injectable()
export class CsdChatAccountsService {
  constructor(
    private readonly repo: CsdChatAccountsRepository,
    private readonly audit: CsdAuditRepository,
  ) {}

  async getMe(actor: CsdActor): Promise<CsdChatMe> {
    const row = await this.repo.findByStaffId(actor.staffId);
    if (!row) {
      return { staff_id: actor.staffId, enabled: false, display_name_vi: null };
    }
    return {
      staff_id: row.staff_id,
      enabled: Boolean(row.enabled),
      display_name_vi: row.display_name_vi,
    };
  }

  async assertEnabled(actor: CsdActor): Promise<void> {
    const me = await this.getMe(actor);
    if (!me.enabled) {
      throw new ForbiddenException({ error: 'chat_disabled' });
    }
  }

  async isEnabled(staffId: number): Promise<boolean> {
    const row = await this.repo.findByStaffId(staffId);
    return Boolean(row?.enabled);
  }

  async searchPeople(excludeStaffId: number, q: string): Promise<CsdChatPersonRow[]> {
    return this.repo.searchPeople(excludeStaffId, q);
  }

  async listAdmin(q?: string): Promise<{ items: CsdChatAccountAdminRow[] }> {
    const items = await this.repo.listAdmin(q);
    return { items };
  }

  async listDirectory(): Promise<{ items: CsdChatStaffDirectoryRow[] }> {
    const items = await this.repo.listDirectory();
    return { items };
  }

  async upsert(
    admin: CsdActor,
    input: { staff_id: number; enabled: boolean; display_name_vi?: string; login_password?: string },
  ): Promise<CsdChatAccountRow> {
    if (!hasCsdCap(admin, 'admin')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'csd', action: 'admin' });
    }
    const staffId = Number(input.staff_id);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      throw new BadRequestException({ error: 'staff_id_required' });
    }
    const staff = await this.repo.findCrmStaff(staffId);
    if (!staff) {
      throw new NotFoundException({ error: 'staff_not_found' });
    }
    const password = input.login_password?.trim();
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        throw new BadRequestException({ error: 'password_too_short' });
      }
      await this.repo.setLoginPassword({ staff_id: staffId, login_password: password });
    }
    const enabled = Boolean(input.enabled);
    const row = await this.repo.upsert({
      staff_id: staffId,
      enabled,
      display_name_vi: input.display_name_vi,
      created_by_staff_id: admin.staffId,
    });
    await this.audit.insert({
      actor_staff_id: admin.staffId,
      action: enabled ? 'chat_account.enable' : 'chat_account.disable',
      entity_type: 'csd_chat_account',
      entity_id: String(staffId),
      after_json: {
        staff_id: staffId,
        enabled,
        created_by_staff_id: admin.staffId,
        login_password_set: Boolean(password),
      },
    });
    return row;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiService } from '../kpi/kpi.service';
import { CrmStaffPgRepository } from './crm-staff-pg.repository';
import { reportsToWouldCycle } from './crm-staff-reports-to.util';
import {
  isValidEmail,
  PatchCrmStaffBody,
  StaffCompetencyPutBody,
  StaffImportBody,
  StaffLevelsPutBody,
} from './crm-staff.types';

@Injectable()
export class CrmStaffService {
  constructor(
    private readonly pg: CrmStaffPgRepository,
    private readonly kpi: KpiService,
  ) {}

  listStaff() {
    return this.pg.listStaff(500);
  }

  async detail(staffId: number) {
    const staff = await this.pg.getStaffById(staffId);
    if (!staff) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return staff;
  }

  async workspace(staffId: number) {
    const bundle = await this.pg.getWorkspace(staffId);
    if (!bundle) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return bundle;
  }

  async patch(staffId: number, body: PatchCrmStaffBody) {
    if ('name' in body && body.name != null) {
      const nm = String(body.name).trim();
      if (!nm) {
        throw new BadRequestException({ error: 'Tên không được trống' });
      }
    }
    if ('email' in body && body.email != null) {
      const em = String(body.email).trim();
      if (em && !isValidEmail(em)) {
        throw new BadRequestException({ error: 'Email không hợp lệ' });
      }
    }
    if ('reports_to_id' in body) {
      await this.assertReportsTo(staffId, body.reports_to_id ?? null);
    }

    const updated = await this.pg.patchStaff(staffId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return updated;
  }

  private async assertReportsTo(staffId: number, managerId: number | null): Promise<void> {
    if (managerId == null) return;
    if (!Number.isInteger(managerId) || managerId <= 0) {
      throw new BadRequestException({ error: 'Quản lý trực tiếp không hợp lệ' });
    }
    if (managerId === staffId) {
      throw new BadRequestException({ error: 'Không thể chọn chính mình làm quản lý' });
    }
    const manager = await this.pg.getStaffById(managerId);
    if (!manager || !Number(manager.active)) {
      throw new BadRequestException({ error: 'Quản lý phải là nhân viên đang hoạt động' });
    }
    const roster = await this.pg.listStaff(2000);
    const edges = new Map<number, number | null>(
      (roster.staff ?? []).map((row) => [row.id, row.reports_to_id ?? null]),
    );
    if (reportsToWouldCycle(staffId, managerId, edges)) {
      throw new BadRequestException({ error: 'Gán quản lý sẽ tạo vòng báo cáo' });
    }
  }

  listStaffKpi(year?: string, month?: string, staffId?: string, team?: string) {
    return this.kpi.listStaffKpi(year, month, staffId, team);
  }

  getLevels() {
    return this.pg.getStaffLevels();
  }

  async saveLevels(body: StaffLevelsPutBody) {
    if (!Array.isArray(body.staff_levels)) {
      throw new BadRequestException({ error: 'staff_levels phải là mảng' });
    }
    try {
      return await this.pg.saveStaffLevels(body.staff_levels);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_LEVELS') {
        throw new BadRequestException({ error: 'staff_levels không hợp lệ' });
      }
      throw err;
    }
  }

  getCompetency() {
    return this.pg.getCompetencyConfig();
  }

  async saveCompetency(body: StaffCompetencyPutBody) {
    const competency = body.competency ?? (body as unknown as Record<string, unknown>);
    if (!competency || typeof competency !== 'object') {
      throw new BadRequestException({ error: 'competency không hợp lệ' });
    }
    return this.pg.saveCompetencyConfig(competency as Record<string, unknown>);
  }

  async importStaff(body: StaffImportBody) {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      throw new BadRequestException({ error: 'Thiếu rows' });
    }
    return this.pg.importStaffRows(rows);
  }
}

import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Pool } from 'pg';
import { Request } from 'express';
import { AdminAuditRepository } from '../../admin-audit/admin-audit.repository';
import { AppConfigService } from '../../config/app-config.service';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { P13HolidayGuard } from '../p13-caps.guard';
import { P13EnabledGuard } from '../p13-enabled.guard';
import { PgCatalog } from '../catalog/pg-catalog';
import { parseIsoDate, WorkingDayService } from '../working-day.service';

type StaffRequest = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/p13')
@UseGuards(P13EnabledGuard, StaffOrInternalKeyGuard, P13HolidayGuard)
export class P13HolidaysController {
  private pool: Pool | null = null;
  private catalog: PgCatalog | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly audit: AdminAuditRepository,
  ) {}

  private db(): PgCatalog {
    if (!this.catalog) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
      this.catalog = new PgCatalog(this.pool);
    }
    return this.catalog;
  }

  @Get('holidays')
  async list() {
    const rows = await this.db().query(
      `SELECT holiday_date::text AS holiday_date, name FROM crm_holidays ORDER BY holiday_date`,
    );
    return { holidays: rows, warning: rows.length ? null : 'holiday_calendar_empty' };
  }

  @Post('holidays')
  async create(@Body() body: { date?: string; name?: string }, @Req() req: StaffRequest) {
    const date = String(body.date ?? '').trim();
    const name = String(body.name ?? '').trim();
    try {
      parseIsoDate(date);
    } catch {
      throw new BadRequestException({ error: 'invalid_date' });
    }
    if (!name) throw new BadRequestException({ error: 'name_required' });
    const actor = req.staffUser?.email || 'internal';
    await this.db().query(
      `INSERT INTO crm_holidays (holiday_date, name, created_by, updated_by)
       VALUES ($1::date, $2, $3, $3)
       ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [date, name, actor],
    );
    await this.audit.logSyntheticEvent({
      event_type: 'p13_holiday',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: name,
      subject_id: date,
      action: 'holiday_upsert',
      summary: `Ngày lễ ${date}`,
      diff_json: { date, name },
    });
    return { date, name };
  }

  @Delete('holidays/:date')
  async remove(@Param('date') date: string, @Req() req: StaffRequest) {
    try {
      parseIsoDate(date);
    } catch {
      throw new BadRequestException({ error: 'invalid_date' });
    }
    await this.db().query(`DELETE FROM crm_holidays WHERE holiday_date = $1::date`, [date]);
    const actor = req.staffUser?.email || 'internal';
    await this.audit.logSyntheticEvent({
      event_type: 'p13_holiday',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: date,
      subject_id: date,
      action: 'holiday_delete',
      summary: `Xóa ngày lễ ${date}`,
      diff_json: { date },
    });
    return { deleted: date };
  }

  @Get('working-days/add')
  async add(@Query('start') start: string, @Query('days') days: string) {
    const count = Number(days);
    if (!Number.isInteger(count) || count < 1) throw new BadRequestException({ error: 'working_days_positive' });
    const holidays = await this.db().query<{ holiday_date: string }>(
      `SELECT holiday_date::text AS holiday_date FROM crm_holidays`,
    );
      const calendar = new WorkingDayService(new Set(holidays.map((row: { holiday_date: string }) => row.holiday_date.slice(0, 10))));
    try {
      return {
        date: calendar.addWorkingDays(start, count),
        warning: holidays.length ? null : 'holiday_calendar_empty',
      };
    } catch (error) {
      throw new BadRequestException({ error: error instanceof Error ? error.message : 'invalid_date' });
    }
  }
}

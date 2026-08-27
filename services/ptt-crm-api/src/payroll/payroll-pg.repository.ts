import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  computeStaffPayroll,
  dashboardSummary,
  defaultWeekdayShifts,
  enrichAttendanceRow,
  normalizeWeekdayShifts,
  parseWorkWeekdays,
  payrollExportFilename,
  payrollExportRowValues,
  payrollExportSummaryRows,
  PAYROLL_EXPORT_HEADERS,
  PAYROLL_EXPORT_SUMMARY_HEADERS,
  policyForApi,
  weekdaysInMonth,
  weekdayShiftsJson,
  workWeekdaysFromShifts,
  type PolicyRecord,
  type PositionPayrollRow,
} from './payroll-engine';

type PgConnection = Pool | PoolClient;

export type PayrollExportOptions = {
  period: string;
  y0: number;
  m0: number;
  y1: number;
  m1: number;
  staffId?: number;
  staffQ?: string;
};

export type PayrollAttendanceOptions = {
  staffId?: number;
  dateFrom?: string;
  dateTo?: string;
};

function sortPositionRows(rows: PositionPayrollRow[]): PositionPayrollRow[] {
  return [...rows].sort((a, b) => {
    const rank = Number(a.rank_level ?? 0) - Number(b.rank_level ?? 0);
    return rank || String(a.position_code ?? '').localeCompare(String(b.position_code ?? ''), 'vi');
  });
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const last = new Date(year, month, 0).getDate();
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` };
}

@Injectable()
export class PayrollPgRepository implements OnModuleDestroy {
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

  private async policyFrom(connection: PgConnection): Promise<PolicyRecord> {
    await connection.query(
      `INSERT INTO crm_payroll_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    );
    const result = await connection.query(`SELECT * FROM crm_payroll_policy WHERE id = 1`);
    return { ...(result.rows[0] as PolicyRecord) };
  }

  private async positionRowsFrom(connection: PgConnection): Promise<PositionPayrollRow[]> {
    const active = await connection.query(
      `SELECT id, code, sort_order
       FROM crm_positions
       WHERE active = TRUE
       ORDER BY sort_order ASC, id ASC`,
    );
    const defaults: Record<string, [number, number, number]> = {
      'CSKH-01': [1, 500_000, 0],
      'KD-01': [2, 1_000_000, 5],
      'VH-01': [3, 1_500_000, 8],
    };
    for (const [index, position] of active.rows.entries()) {
      const fallback: [number, number, number] = [
        index + 1,
        Math.max(0, (4 - index) * 300_000),
        0,
      ];
      const [rank, allowance, bonus] = defaults[String(position.code ?? '')] ?? fallback;
      await connection.query(
        `INSERT INTO crm_position_payroll
           (position_id, rank_level, allowance_vnd, bonus_pct, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (position_id) DO NOTHING`,
        [Number(position.id), rank, allowance, bonus],
      );
    }
    const result = await connection.query(
      `SELECT pp.*, p.code AS position_code, p.name AS position_name
       FROM crm_position_payroll pp
       JOIN crm_positions p ON p.id = pp.position_id
       WHERE p.active = TRUE
       ORDER BY pp.rank_level ASC, p.sort_order ASC`,
    );
    return sortPositionRows(result.rows as PositionPayrollRow[]);
  }

  async getPolicy(): Promise<Record<string, unknown>> {
    return { policy: policyForApi(await this.policyFrom(this.db)) };
  }

  async updatePolicy(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const numberField = (key: string, fallback: number, low: number, high: number): number => {
      const value = Number(payload[key] ?? fallback);
      return Number.isFinite(value) ? Math.max(low, Math.min(value, high)) : fallback;
    };
    const rawShifts = payload.weekday_shifts;
    const shifts =
      Array.isArray(rawShifts) && rawShifts.length > 0
        ? normalizeWeekdayShifts(rawShifts)
        : defaultWeekdayShifts({
            workWeekdays: parseWorkWeekdays(
              String(payload.work_weekdays ?? '0,1,2,3,4'),
            ),
            shiftStart: String(payload.shift_start ?? '08:30').trim().slice(0, 5),
            shiftEnd: String(payload.shift_end ?? '17:30').trim().slice(0, 5),
            breakMinutes: numberField('break_minutes_default', 60, 0, 24 * 60),
            standardHours: numberField('standard_hours_per_day', 8, 0.5, 24),
          });
    const firstWork = shifts.find((shift) => shift.work) ?? shifts[0]!;
    let bonusMode = String(payload.bonus_mode ?? 'attendance').trim().toLowerCase();
    if (bonusMode !== 'attendance' && bonusMode !== 'none') bonusMode = 'attendance';
    await this.db.query(
      `INSERT INTO crm_payroll_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    );
    await this.db.query(
      `UPDATE crm_payroll_policy SET
         work_weekdays = $1, shift_start = $2, shift_end = $3,
         break_minutes_default = $4, late_grace_minutes = $5,
         late_penalty_vnd_per_min = $6, late_penalty_max_vnd = $7,
         standard_hours_per_day = $8, bonus_mode = $9, bonus_pct = $10,
         bonus_min_days = $11, overtime_multiplier = $12,
         weekday_shifts = $13, updated_at = NOW()
       WHERE id = 1`,
      [
        workWeekdaysFromShifts(shifts),
        String(firstWork.shift_start ?? '08:30').trim().slice(0, 5),
        String(firstWork.shift_end ?? '17:30').trim().slice(0, 5),
        numberField('break_minutes_default', Number(firstWork.break_minutes ?? 60), 0, 1440),
        numberField('late_grace_minutes', 5, 0, 120),
        numberField('late_penalty_vnd_per_min', 5000, 0, 50_000_000),
        numberField('late_penalty_max_vnd', 200_000, 0, 500_000_000),
        numberField('standard_hours_per_day', Number(firstWork.standard_hours ?? 8), 0.5, 24),
        bonusMode,
        numberField('bonus_pct', 5, 0, 100),
        numberField('bonus_min_days', 20, 0, 31),
        numberField('overtime_multiplier', 1.5, 1, 3),
        weekdayShiftsJson(shifts),
      ],
    );
    return this.getPolicy();
  }

  async getPositionRates(): Promise<{ positions: PositionPayrollRow[] }> {
    return { positions: await this.positionRowsFrom(this.db) };
  }

  async updatePositionRates(items: unknown[]): Promise<{ positions: PositionPayrollRow[] }> {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const positionId = Number(row.position_id ?? 0);
      if (!Number.isFinite(positionId) || positionId <= 0) continue;
      const rank = Math.max(1, Math.min(Number(row.rank_level) || 1, 99));
      const allowance = Math.max(0, Math.min(Number(row.allowance_vnd) || 0, 999_999_999));
      const bonus = Math.max(0, Math.min(Number(row.bonus_pct) || 0, 100));
      await this.db.query(
        `INSERT INTO crm_position_payroll
           (position_id, rank_level, allowance_vnd, bonus_pct, updated_at)
         SELECT id, $2, $3, $4, NOW() FROM crm_positions WHERE id = $1
         ON CONFLICT (position_id) DO UPDATE SET
           rank_level = EXCLUDED.rank_level,
           allowance_vnd = EXCLUDED.allowance_vnd,
           bonus_pct = EXCLUDED.bonus_pct,
           updated_at = NOW()`,
        [positionId, rank, allowance, bonus],
      );
    }
    return this.getPositionRates();
  }

  async fetchDashboard(year: number, month: number): Promise<Record<string, unknown>> {
    const { from, to } = monthBounds(year, month);
    const [policy, positions, staff, attendance, today] = await Promise.all([
      this.policyFrom(this.db),
      this.positionRowsFrom(this.db),
      this.db.query(`SELECT COUNT(*)::int AS count FROM crm_staff WHERE active = TRUE`),
      this.db.query(
        `SELECT to_char(work_date, 'YYYY-MM-DD') AS work_date,
                check_in, check_out, break_minutes
         FROM crm_attendance
         WHERE work_date BETWEEN $1::date AND $2::date`,
        [from, to],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS count
         FROM crm_attendance
         WHERE work_date = CURRENT_DATE AND btrim(check_in) <> ''`,
      ),
    ]);
    return {
      ...dashboardSummary({
        year,
        month,
        policy,
        staffActive: Number(staff.rows[0]?.count ?? 0),
        attendanceRows: attendance.rows as Array<Record<string, unknown>>,
        checkedInToday: Number(today.rows[0]?.count ?? 0),
      }),
      position_rates: positions,
    };
  }

  private payrollLinesSql(where: string): string {
    return `SELECT pl.*,
                   s.name AS staff_name, s.internal_code AS staff_code,
                   p.year AS payroll_year, p.month AS payroll_month,
                   p.status AS payroll_status, p.workdays_standard,
                   (
                     SELECT COUNT(*)::int
                     FROM crm_attendance a
                     WHERE a.staff_id = pl.staff_id
                       AND EXTRACT(YEAR FROM a.work_date)::int = p.year
                       AND EXTRACT(MONTH FROM a.work_date)::int = p.month
                       AND btrim(a.check_in) <> '' AND btrim(a.check_out) <> ''
                   ) AS days_present,
                   (pl.net_vnd - pl.position_allowance_vnd - pl.bonus_vnd
                     + pl.late_deduction_vnd) AS salary_from_attendance_vnd,
                   (pl.position_allowance_vnd + pl.bonus_vnd) AS allowances_vnd,
                   pl.late_deduction_vnd AS deductions_vnd,
                   pl.net_vnd AS net_salary_vnd
            FROM crm_payroll_line pl
            JOIN crm_payroll p ON p.id = pl.payroll_id
            JOIN crm_staff s ON s.id = pl.staff_id
            WHERE ${where}`;
  }

  async getPayroll(
    year: number,
    month: number,
  ): Promise<{
    payroll: Record<string, unknown> | null;
    lines: Array<Record<string, unknown>>;
  }> {
    const payroll = await this.db.query(
      `SELECT * FROM crm_payroll WHERE year = $1 AND month = $2`,
      [year, month],
    );
    const row = payroll.rows[0] as Record<string, unknown> | undefined;
    if (!row) return { payroll: null, lines: [] };
    const lines = await this.db.query(
      `${this.payrollLinesSql('pl.payroll_id = $1')} ORDER BY s.name ASC`,
      [Number(row.id)],
    );
    return { payroll: { ...row }, lines: lines.rows as Array<Record<string, unknown>> };
  }

  async computePayroll(
    year: number,
    month: number,
  ): Promise<{
    payroll: Record<string, unknown>;
    lines: Array<Record<string, unknown>>;
  }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const policy = await this.policyFrom(client);
      const standard = weekdaysInMonth(policy, year, month);
      let payroll = await client.query(
        `SELECT * FROM crm_payroll WHERE year = $1 AND month = $2 FOR UPDATE`,
        [year, month],
      );
      if (payroll.rows[0] && String(payroll.rows[0].status) === 'final') {
        throw new Error('PAYROLL_LOCKED');
      }
      if (!payroll.rows[0]) {
        payroll = await client.query(
          `INSERT INTO crm_payroll
             (year, month, workdays_standard, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'draft', NOW(), NOW())
           RETURNING *`,
          [year, month, standard],
        );
      } else {
        payroll = await client.query(
          `UPDATE crm_payroll
           SET workdays_standard = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [Number(payroll.rows[0].id), standard],
        );
      }
      const payrollId = Number(payroll.rows[0].id);
      const positions = await this.positionRowsFrom(client);
      const positionMap: Record<number, PositionPayrollRow> = {};
      for (const position of positions) {
        positionMap[Number(position.position_id)] = position;
      }
      const staff = await client.query(
        `SELECT id, name, base_salary_vnd, position_id
         FROM crm_staff WHERE active = TRUE ORDER BY name ASC`,
      );
      const { from, to } = monthBounds(year, month);
      const attendance = await client.query(
        `SELECT staff_id, to_char(work_date, 'YYYY-MM-DD') AS work_date,
                check_in, check_out, break_minutes
         FROM crm_attendance
         WHERE work_date BETWEEN $1::date AND $2::date
         ORDER BY work_date ASC`,
        [from, to],
      );
      const attendanceByStaff = new Map<number, Array<Record<string, unknown>>>();
      for (const row of attendance.rows as Array<Record<string, unknown>>) {
        const staffId = Number(row.staff_id);
        const rows = attendanceByStaff.get(staffId) ?? [];
        rows.push(row);
        attendanceByStaff.set(staffId, rows);
      }
      for (const staffRow of staff.rows as Array<Record<string, unknown>>) {
        const staffId = Number(staffRow.id);
        const computed = computeStaffPayroll({
          staffId,
          baseSalaryVnd: Number(staffRow.base_salary_vnd ?? 0),
          positionId: staffRow.position_id == null ? null : Number(staffRow.position_id),
          year,
          month,
          policy,
          positionMap,
          attendanceRows: attendanceByStaff.get(staffId) ?? [],
        });
        const existing = await client.query(
          `SELECT id, note FROM crm_payroll_line
           WHERE payroll_id = $1 AND staff_id = $2
           ORDER BY id ASC LIMIT 1`,
          [payrollId, staffId],
        );
        const values = [
          Number(staffRow.base_salary_vnd ?? 0),
          Number(computed.hours_worked_total),
          Number(computed.late_minutes_total),
          Number(computed.late_deduction_vnd),
          Number(computed.position_allowance_vnd),
          Number(computed.bonus_vnd),
          Number(computed.net_salary_vnd),
        ];
        if (existing.rows[0]) {
          await client.query(
            `UPDATE crm_payroll_line SET
               base_salary_vnd = $2, hours_worked_total = $3,
               late_minutes_total = $4, late_deduction_vnd = $5,
               position_allowance_vnd = $6, bonus_vnd = $7,
               net_vnd = $8, updated_at = NOW()
             WHERE id = $1`,
            [Number(existing.rows[0].id), ...values],
          );
        } else {
          await client.query(
            `INSERT INTO crm_payroll_line
               (payroll_id, staff_id, base_salary_vnd, hours_worked_total,
                late_minutes_total, late_deduction_vnd, position_allowance_vnd,
                bonus_vnd, net_vnd, note, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', NOW())`,
            [payrollId, staffId, ...values],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.getPayroll(year, month) as Promise<{
      payroll: Record<string, unknown>;
      lines: Array<Record<string, unknown>>;
    }>;
  }

  async patchPayroll(
    payrollId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    let status: string | null = null;
    if ('status' in payload) {
      const candidate = String(payload.status ?? '').trim().toLowerCase();
      if (candidate === 'draft' || candidate === 'final') status = candidate;
    }
    const result = await this.db.query(
      `UPDATE crm_payroll
       SET status = COALESCE($2, status), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [payrollId, status],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async patchPayrollLine(
    lineId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const current = await this.db.query(
      `${this.payrollLinesSql('pl.id = $1')} LIMIT 1`,
      [lineId],
    );
    const row = current.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    if (String(row.payroll_status ?? '') === 'final') throw new Error('PAYROLL_LOCKED');
    let allowances = Number(row.allowances_vnd ?? 0);
    let deductions = Number(row.deductions_vnd ?? 0);
    let note = String(row.note ?? '');
    if ('allowances_vnd' in payload && Number.isFinite(Number(payload.allowances_vnd))) {
      allowances = Math.max(0, Math.min(Number(payload.allowances_vnd), 9_999_999_999));
    }
    if ('deductions_vnd' in payload && Number.isFinite(Number(payload.deductions_vnd))) {
      deductions = Math.max(0, Math.min(Number(payload.deductions_vnd), 9_999_999_999));
    }
    if (typeof payload.note === 'string') note = payload.note.trim().slice(0, 2000);
    const salary = Number(row.salary_from_attendance_vnd ?? 0);
    await this.db.query(
      `UPDATE crm_payroll_line SET
         position_allowance_vnd = $2, bonus_vnd = 0,
         late_deduction_vnd = $3, net_vnd = $4,
         note = $5, updated_at = NOW()
       WHERE id = $1`,
      [lineId, allowances, deductions, salary + allowances - deductions, note],
    );
    const updated = await this.db.query(
      `${this.payrollLinesSql('pl.id = $1')} LIMIT 1`,
      [lineId],
    );
    return (updated.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async fetchExportRows(opts: PayrollExportOptions): Promise<Array<Record<string, unknown>>> {
    const clauses = [
      '(p.year > $1 OR (p.year = $1 AND p.month >= $2))',
      '(p.year < $3 OR (p.year = $3 AND p.month <= $4))',
    ];
    const params: Array<string | number> = [opts.y0, opts.m0, opts.y1, opts.m1];
    if (opts.staffId != null) {
      params.push(opts.staffId);
      clauses.push(`pl.staff_id = $${params.length}`);
    } else if (opts.staffQ) {
      params.push(`%${opts.staffQ}%`);
      const index = params.length;
      clauses.push(
        `(s.name ILIKE $${index} OR s.internal_code ILIKE $${index}
          OR s.attendance_pin ILIKE $${index})`,
      );
    }
    const result = await this.db.query(
      `${this.payrollLinesSql(clauses.join(' AND '))}
       ORDER BY p.year ASC, p.month ASC, s.name ASC`,
      params,
    );
    return result.rows as Array<Record<string, unknown>>;
  }

  async exportPayrollBundle(opts: PayrollExportOptions): Promise<Record<string, unknown>> {
    const rows = await this.fetchExportRows(opts);
    const includeSummary =
      opts.period === 'quarter' ||
      opts.period === 'range' ||
      opts.y0 !== opts.y1 ||
      opts.m0 !== opts.m1;
    return {
      period: opts.period,
      from: { year: opts.y0, month: opts.m0 },
      to: { year: opts.y1, month: opts.m1 },
      filename: payrollExportFilename(opts.period, opts.y0, opts.m0, opts.y1, opts.m1),
      headers: PAYROLL_EXPORT_HEADERS,
      rows: rows.map(payrollExportRowValues),
      include_summary: includeSummary,
      summary_headers: PAYROLL_EXPORT_SUMMARY_HEADERS,
      summary_rows: includeSummary && rows.length ? payrollExportSummaryRows(rows) : [],
      row_count: rows.length,
    };
  }

  async listMyPayslips(staffId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.query(
      `SELECT p.id AS payroll_id, p.year, p.month, p.status AS payroll_status,
              pl.net_vnd AS net_pay,
              (pl.net_vnd + pl.late_deduction_vnd) AS gross_pay,
              pl.late_deduction_vnd AS total_deductions,
              (
                SELECT COUNT(*)::int FROM crm_attendance a
                WHERE a.staff_id = pl.staff_id
                  AND EXTRACT(YEAR FROM a.work_date)::int = p.year
                  AND EXTRACT(MONTH FROM a.work_date)::int = p.month
                  AND btrim(a.check_in) <> '' AND btrim(a.check_out) <> ''
              ) AS workdays_actual
       FROM crm_payroll_line pl
       JOIN crm_payroll p ON p.id = pl.payroll_id
       WHERE pl.staff_id = $1
       ORDER BY p.year DESC, p.month DESC
       LIMIT 24`,
      [staffId],
    );
    return result.rows as Array<Record<string, unknown>>;
  }

  async listAttendance(
    opts: PayrollAttendanceOptions,
  ): Promise<{ attendance: Array<Record<string, unknown>> }> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (opts.staffId != null) {
      params.push(opts.staffId);
      clauses.push(`a.staff_id = $${params.length}`);
    }
    if (opts.dateFrom) {
      params.push(opts.dateFrom);
      clauses.push(`a.work_date >= $${params.length}::date`);
    }
    if (opts.dateTo) {
      params.push(opts.dateTo);
      clauses.push(`a.work_date <= $${params.length}::date`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [policy, result] = await Promise.all([
      this.policyFrom(this.db),
      this.db.query(
        `SELECT a.*, to_char(a.work_date, 'YYYY-MM-DD') AS work_date,
                s.name AS staff_name, s.internal_code AS staff_code
         FROM crm_attendance a
         JOIN crm_staff s ON s.id = a.staff_id
         ${where}
         ORDER BY a.work_date DESC, s.name ASC`,
        params,
      ),
    ]);
    return {
      attendance: (result.rows as Array<Record<string, unknown>>).map((row) =>
        enrichAttendanceRow(row, policy),
      ),
    };
  }
}

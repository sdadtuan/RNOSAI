import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const payrollDir = __dirname;

describe('payroll PostgreSQL-only boundary', () => {
  it('contains no SQLite runtime dependency', () => {
    const files = [
      'payroll.service.ts',
      'payroll.module.ts',
      'payroll-engine.ts',
      'payroll-pg.repository.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(payrollDir, file), 'utf8');
      expect(source).not.toContain('node:sqlite');
      expect(source).not.toContain('PayrollSqliteRepository');
    }
    expect(existsSync(join(payrollDir, 'payroll-sqlite.repository.ts'))).toBe(false);
  });

  it('routes payroll through the PostgreSQL repository', () => {
    const service = readFileSync(join(payrollDir, 'payroll.service.ts'), 'utf8');
    const module = readFileSync(join(payrollDir, 'payroll.module.ts'), 'utf8');

    expect(service).toContain('PayrollPgRepository');
    expect(module).toContain('PayrollPgRepository');
  });
});

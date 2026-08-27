import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CrmStaffService PostgreSQL cutover', () => {
  it('does not import the SQLite repository', () => {
    const service = fs.readFileSync(
      path.join(__dirname, 'crm-staff.service.ts'),
      'utf8',
    );

    expect(service).not.toMatch(
      /CrmStaffSqliteRepository|crm-staff-sqlite\.repository/,
    );
  });
});

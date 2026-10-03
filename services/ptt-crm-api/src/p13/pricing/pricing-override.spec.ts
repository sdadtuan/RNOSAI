import { readFileSync } from 'fs';
import { join } from 'path';
import { mergeRoles } from './pricing.service';

const base = [
  { role_code: 'dev', name: 'Dev', monthly_salary: null, insurance_pct: null, monthly_benefits: null, productive_hours: '132', hourly_rate: null, note: null },
  { role_code: 'am', name: 'AM', monthly_salary: null, insurance_pct: null, monthly_benefits: null, productive_hours: '132', hourly_rate: null, note: null },
];

describe('mergeRoles', () => {
  it('applies one salary template to every role and keeps the role code', () => {
    const merged = mergeRoles(base, {
      monthly_salary: '20000000',
      insurance_pct: '0.20',
      monthly_benefits: '1000000',
      productive_hours: '132',
    });
    expect(merged.map((role) => role.role_code)).toEqual(['dev', 'am']);
    expect(merged.every((role) => role.monthly_salary === '20000000')).toBe(true);
    expect(merged[0]?.name).toBe('Dev');
  });

  it('preview reads the version and does not write updated_at', () => {
    const source = readFileSync(join(__dirname, 'pricing.service.ts'), 'utf8');
    const body = source.slice(source.indexOf('async preview('), source.indexOf('private async loadView'));
    expect(body).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
    expect(body).not.toContain('this.audit');
    expect(body).not.toContain('updated_at =');
  });

  it('uses the same margin guard on preview, draft patch, and activate', () => {
    const source = readFileSync(join(__dirname, 'pricing.service.ts'), 'utf8');
    for (const name of ['async preview(', 'async patch(', 'async activate(']) {
      const start = source.indexOf(name);
      const next = source.indexOf('async ', start + name.length);
      const body = source.slice(start, next === -1 ? undefined : next);
      expect(body).toContain('assertMarginPct(');
    }
  });

  it('patches only the named role from an array', () => {
    const merged = mergeRoles(base, [{ role_code: 'am', monthly_salary: '1' }]);
    expect(merged.find((role) => role.role_code === 'am')?.monthly_salary).toBe('1');
    expect(merged.find((role) => role.role_code === 'dev')?.monthly_salary).toBeNull();
  });
});

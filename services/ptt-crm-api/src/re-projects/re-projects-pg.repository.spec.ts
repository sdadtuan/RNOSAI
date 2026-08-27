import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('RE projects PostgreSQL SQL compatibility', () => {
  const repositorySource = readFileSync(join(__dirname, 're-projects-pg.repository.ts'), 'utf8');
  const channelsSource = readFileSync(join(__dirname, 're-projects-channels-pg.repository.ts'), 'utf8');

  it('uses PostgreSQL boolean predicates in RE project repositories', () => {
    const source = `${repositorySource}\n${channelsSource}`;

    expect(source).not.toMatch(/\bactive\s*=\s*1\b/i);
    expect(source).not.toMatch(/COALESCE\s*\(\s*active\s*,\s*1\s*\)\s*=\s*1/i);
    expect(source).not.toMatch(/COALESCE\s*\(\s*is_duplicate\s*,\s*0\s*\)\s*=\s*0/i);
    expect(repositorySource).toContain('active IS TRUE');
    expect(channelsSource).toContain('active IS NOT FALSE');
    expect(repositorySource).toContain('is_duplicate IS NOT TRUE');
  });

  it('writes staff KPI notes to the PostgreSQL notes column', () => {
    expect(repositorySource).toContain('status,notes,created_at,updated_at');
    expect(repositorySource).toContain('notes=EXCLUDED.notes');
    expect(repositorySource).not.toContain('status,note,created_at,updated_at');
    expect(repositorySource).not.toContain('note=EXCLUDED.note');
  });
});

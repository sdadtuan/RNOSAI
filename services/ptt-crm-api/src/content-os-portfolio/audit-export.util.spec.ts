import { AUDIT_EXPORT_ACTION, formatAuditExportCsv } from './audit-export.util';

describe('formatAuditExportCsv', () => {
  it('emits actor, action, entity, time headers and no fake rows when empty', () => {
    const csv = formatAuditExportCsv([]);
    const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines[0]).toBe('actor,action,entity,created_at');
    expect(lines).toHaveLength(1);
    expect(csv).not.toMatch(/Sunlight|Nova|prompt|sk_|token=/i);
  });

  it('serializes audit metadata only and keeps action audit_export', () => {
    const csv = formatAuditExportCsv([
      {
        actor: 'admin@ptt.vn',
        action: AUDIT_EXPORT_ACTION,
        entity: 'portfolio_audit',
        created_at: '2026-09-11T07:47:00.000Z',
        prompt: 'SECRET_PROMPT should never appear',
      },
    ]);
    expect(csv).toContain('admin@ptt.vn,audit_export,portfolio_audit,2026-09-11T07:47:00.000Z');
    expect(csv).not.toMatch(/SECRET_PROMPT|prompt/i);
  });
});

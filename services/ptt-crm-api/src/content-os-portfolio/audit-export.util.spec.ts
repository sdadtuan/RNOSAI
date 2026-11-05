import { AUDIT_CSV_HEADER, AUDIT_EXPORT_ACTION, formatAuditExportCsv } from './audit-export.util';

describe('formatAuditExportCsv', () => {
  it('emits actor, action, entity, time, and id headers and no fake rows when empty', () => {
    const csv = formatAuditExportCsv([]);
    const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
    expect(lines[0]).toBe(AUDIT_CSV_HEADER);
    expect(AUDIT_CSV_HEADER).toBe('actor,action,entity,created_at,item_id,id');
    expect(lines).toHaveLength(1);
    expect(csv).not.toMatch(/Sunlight|Nova|prompt|sk_|token=/i);
  });

  it('serializes real activity metadata only and never dumps prompts or tokens', () => {
    const csv = formatAuditExportCsv([
      {
        actor: 'editor@ptt.vn',
        action: 'manual',
        entity: 'item_version',
        created_at: '2026-09-11T07:47:00.000Z',
        item_id: 21,
        id: 9,
        prompt: 'SECRET_PROMPT should never appear',
        body_json: { prompt: 'also secret' },
      },
    ]);
    expect(csv).toContain('editor@ptt.vn,manual,item_version,2026-09-11T07:47:00.000Z,21,9');
    expect(csv).not.toMatch(/SECRET_PROMPT|prompt|token/i);
    expect(csv).not.toContain(AUDIT_EXPORT_ACTION);
  });
});

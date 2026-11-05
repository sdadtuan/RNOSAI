import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminIntegrationsService } from '../admin-governance/admin-integrations.service';
import { RevopsSettingsService } from './revops-settings.service';

describe('RevopsSettingsService', () => {
  function build() {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/staff_users WHERE active/i.test(sql)) return { rows: [{ count: 248 }] };
        if (/staff_departments/i.test(sql)) return { rows: [{ count: 4 }] };
        if (/staff_teams/i.test(sql)) return { rows: [{ count: 18 }] };
        if (/expires_at/i.test(sql)) return { rows: [{ count: 3 }] };
        if (/crm_lead_activities/i.test(sql)) return { rows: [{ count: 8 }] };
        if (/account_owner_staff_id/i.test(sql)) return { rows: [{ count: 3 }] };
        if (/crm_am_plans/i.test(sql)) return { rows: [{ count: 4 }] };
        if (/staff_rbac_audit_log/i.test(sql)) {
          return {
            rows: [
              {
                id: '9',
                actor_email: 'ops@ptt.vn',
                action: 'cap_grant',
                section_id: 'crm_revops.commission',
                metadata_json: {},
                created_at: '2026-09-06T09:00:00Z',
              },
            ],
          };
        }
        return { rows: [{ count: 0 }] };
      }),
    };
    const audit = {
      listEvents: jest.fn().mockResolvedValue({
        events: [
          {
            id: 'admin:1',
            actor_email: 'admin@ptt.vn',
            action: 'update',
            summary: 'crm_revops routing rule published',
            diff_json: {},
            created_at: '2026-09-06T08:00:00Z',
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
    } as unknown as AdminAuditService;
    const integrations = {
      listIntegrations: jest.fn().mockResolvedValue({
        integrations: [
          { id: 'webhook-meta', kind: 'webhook', name: 'Meta lead webhook', status: 'ok', detail: 'Enabled' },
        ],
        summary: { ok: 1 },
      }),
    } as unknown as AdminIntegrationsService;
    const svc = new RevopsSettingsService(db as never, audit, integrations);
    return { svc, audit, integrations };
  }

  it('returns org, data quality, integrations, matrix, and audit timeline', async () => {
    const { svc } = build();
    const out = await svc.getCenter();
    expect(out.org.activeUsers).toBe(248);
    expect(out.dataQuality.totalIssues).toBe(15);
    expect(out.integrations.items).toHaveLength(3);
    expect(out.roleMatrix).toHaveLength(6);
    expect(out.auditTimeline.length).toBeGreaterThan(0);
    expect(out.adminLinks.permissions).toBe('/admin/crm/permissions');
  });
});

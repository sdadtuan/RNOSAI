import {
  REVOPS_ROLE_MATRIX,
  buildDataQualityIssues,
  buildIntegrationHealth,
  dataQualityTotal,
  formatAuditTimelineSummary,
  integrationHealthyCount,
} from './revops-settings.util';

describe('revops-settings.util', () => {
  it('seeds role matrix with 6 modules', () => {
    expect(REVOPS_ROLE_MATRIX).toHaveLength(6);
    expect(REVOPS_ROLE_MATRIX[0]?.module).toBe('Lead & Routing');
  });

  it('maps integration health with unknown ERP/HR fallback', () => {
    const rows = buildIntegrationHealth([
      { id: 'webhook-meta', kind: 'webhook', name: 'Meta lead webhook', status: 'ok', detail: 'Enabled' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.key === 'facebook_leads')?.status).toBe('healthy');
    expect(rows.find((r) => r.key === 'erp')?.status).toBe('unknown');
  });

  it('builds data quality issues and totals', () => {
    const issues = buildDataQualityIssues({
      dealsWithoutNextAction: 8,
      accountsWithoutOwner: 3,
      strategicWithoutPlan: 4,
    });
    expect(dataQualityTotal(issues)).toBe(15);
    expect(issues[0]?.severity).toBe('critical');
  });

  it('counts healthy integrations', () => {
    const rows = buildIntegrationHealth([
      { id: 'webhook-meta', kind: 'webhook', name: 'Meta', status: 'ok', detail: 'ok' },
      { id: 'staff-sso', kind: 'auth', name: 'SSO', status: 'warning', detail: 'warn' },
    ]);
    expect(integrationHealthyCount(rows)).toBe(1);
  });

  it('formats audit summary fallback', () => {
    expect(
      formatAuditTimelineSummary({
        actorEmail: 'ops@ptt.vn',
        action: 'publish routing rule',
        sectionId: 'crm_revops.routing',
      }),
    ).toContain('publish routing rule');
  });
});

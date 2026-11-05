import { DeliveryBudgetRepository } from './delivery-budget.repository';

describe('DeliveryBudgetRepository.previewImpact', () => {
  it('adds draft to internal cost excluding client media and computes margin', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM crm_delivery_projects') && sql.includes('contract_budget')) {
          return {
            rows: [
              {
                contract_budget: '1000',
                internal_cost_budget: '600',
                client_media_budget: '50',
                contingency_amount: '50',
                forecast_cost: '650',
                gross_margin_pct: '30',
                finance_policy_json: { min_gross_margin_pct: 30 },
                status: 'draft',
              },
            ],
          };
        }
        if (sql.includes('FROM crm_delivery_budget_items')) {
          return {
            rows: [
              {
                id: 'item-1',
                project_id: 'proj-1',
                name: 'Labor',
                service_code: null,
                kind: 'labor',
                media_borne: null,
                cost_center: null,
                owner_staff_id: null,
                approved_budget: '600',
                forecast: '600',
                actual: '0',
                allocation_method: 'even',
                description: null,
                row_version: 1,
              },
              {
                id: 'item-2',
                project_id: 'proj-1',
                name: 'Client media',
                service_code: null,
                kind: 'media',
                media_borne: 'client_borne',
                cost_center: null,
                owner_staff_id: null,
                approved_budget: '50',
                forecast: '50',
                actual: '0',
                allocation_method: 'even',
                description: null,
                row_version: 1,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const repo = new DeliveryBudgetRepository(db as never);
    const out = await repo.previewImpact('proj-1', {
      name: 'Agency media',
      kind: 'media',
      media_borne: 'agency_borne',
      approved_budget: '100',
      forecast: '100',
    });
    expect(out.internal_before).toBe('600.00');
    expect(out.internal_after).toBe('700.00');
    expect(out.margin_before).toBe('35');
    expect(out.margin_after).toBe('25');
    expect(out.policy_critical).toBe(true);
  });

  it('client-borne media does not reduce margin', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM crm_delivery_projects') && sql.includes('contract_budget')) {
          return {
            rows: [
              {
                contract_budget: '1000',
                internal_cost_budget: '600',
                client_media_budget: '0',
                contingency_amount: '50',
                forecast_cost: '600',
                gross_margin_pct: '35',
                finance_policy_json: { min_gross_margin_pct: 30 },
                status: 'draft',
              },
            ],
          };
        }
        if (sql.includes('FROM crm_delivery_budget_items')) {
          return {
            rows: [
              {
                id: 'item-1',
                project_id: 'proj-1',
                name: 'Labor',
                service_code: null,
                kind: 'labor',
                media_borne: null,
                cost_center: null,
                owner_staff_id: null,
                approved_budget: '600',
                forecast: '600',
                actual: '0',
                allocation_method: 'even',
                description: null,
                row_version: 1,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const repo = new DeliveryBudgetRepository(db as never);
    const out = await repo.previewImpact('proj-1', {
      name: 'Client media',
      kind: 'media',
      media_borne: 'client_borne',
      approved_budget: '200',
      forecast: '200',
    });
    expect(out.internal_before).toBe('600.00');
    expect(out.internal_after).toBe('600.00');
    expect(out.margin_after).toBe('35');
    expect(out.policy_critical).toBe(false);
  });
});

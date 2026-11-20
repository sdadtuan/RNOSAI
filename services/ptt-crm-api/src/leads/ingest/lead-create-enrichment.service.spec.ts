import { BadRequestException } from '@nestjs/common';
import { LeadCreateEnrichmentService } from './lead-create-enrichment.service';
import { AppConfigService } from '../../config/app-config.service';

describe('LeadCreateEnrichmentService B2B gate', () => {
  const dedup = {
    findByExternalId: jest.fn(async () => null),
    findContactDuplicates: jest.fn(async () => []),
  };
  const rulesRepo = {
    fetchClientIndustry: jest.fn(async () => null),
    fetchSnapshot: jest.fn(async () => null),
  };
  const autoAssign = { assignOwner: jest.fn(async () => null) };
  const b2bFirstAssign = { assign: jest.fn(async () => ({ ownerId: null, strategy: 'hybrid', reason: 'empty', confidence: null })) };

  it('B2B-01 missing project when flag on', async () => {
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedup as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    await expect(svc.enrich({ full_name: 'Test', lead_flow_kind: 'b2b_prospect' })).rejects.toEqual(
      new BadRequestException({ error: 'b2b_project_required' }),
    );
  });

  it('sets PTT owner company when project provided', async () => {
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedup as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    const out = await svc.enrich({
      full_name: 'Test',
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
    });
    expect(out.owner_company_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(out.client_id).toBeNull();
    expect(out.b2b_project_id).toBe('proj-1');
  });

  it('merges a phone that returns inside the dedupe window', async () => {
    const since = new Date('2026-09-13T00:00:00.000Z');
    const dedupWindow = {
      contactDedupeSince: jest.fn(async () => since),
      findByExternalId: jest.fn(async () => null),
      findContactDuplicates: jest.fn(async () => [
        { lead_id: 42, full_name: 'Cũ', phone: '0901234567', email: null, owner_id: 7 },
      ]),
    };
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedupWindow as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    const out = await svc.enrich({
      full_name: 'Mới',
      phone: '0901234567',
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
    });
    expect(dedupWindow.findContactDuplicates).toHaveBeenCalledWith(
      expect.objectContaining({ createdAfter: since }),
    );
    expect(out.is_duplicate).toBe(true);
    expect(out.meta?.duplicate_of_id).toBe(42);
    expect(out.owner_id).toBe(7);
    expect(out.meta?.assign_strategy).toBe('duplicate_owner');
  });

  it('keeps a lost contact as a duplicate after the dedupe window', async () => {
    const dedupLost = {
      contactDedupeSince: jest.fn(async () => new Date('2026-09-13T00:00:00.000Z')),
      findByExternalId: jest.fn(async () => null),
      findContactDuplicates: jest.fn(async () => []),
      findLostContact: jest.fn(async () => [
        { lead_id: 9, full_name: 'Đã mất', phone: '0901234567', email: null, owner_id: 3 },
      ]),
    };
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedupLost as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    const out = await svc.enrich({
      full_name: 'Quay lại',
      phone: '0901234567',
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
      status: 'moi',
    });
    expect(out.is_duplicate).toBe(true);
    expect(out.status).toBe('moi');
    expect(out.meta?.duplicate_of_id).toBe(9);
    expect(out.meta?.dedup_reason).toBe('lost_contact');
    expect(out.owner_id).toBe(3);
    expect(out.meta?.assign_reason).toBe('duplicate_of_9');
  });

  it('clears an unticked or non-Sales owner_id even on duplicates and empty-pool fallback', async () => {
    const dedupNoOwner = {
      contactDedupeSince: jest.fn(async () => new Date('2026-09-13T00:00:00.000Z')),
      findByExternalId: jest.fn(async () => null),
      findContactDuplicates: jest.fn(async () => [
        { lead_id: 50, full_name: 'Trùng chưa có owner', phone: '0909998888', email: null, owner_id: null },
      ]),
    };
    const rulesWithQuery = {
      fetchClientIndustry: jest.fn(async () => null),
      fetchSnapshot: jest.fn(async () => null),
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        if (/crm_positions/i.test(sql)) {
          // id=1 is SUPER-ADMIN (not Sales), id=57 is Sales
          return { rows: Number(params[0]) === 57 ? [{ ok: 1 }] : [] };
        }
        if (/can_receive_leads/i.test(sql)) {
          // neither id=1 nor id=57 has can_receive_leads=true
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedupNoOwner as never,
      rulesWithQuery as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );

    const adminDupOut = await svc.enrich({
      full_name: 'Dup Admin',
      phone: '0909998888',
      owner_id: 1,
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
    });
    expect(adminDupOut.owner_id).toBeNull();
    expect(adminDupOut.meta?.assign_override_from).toBe(1);

    const untickedSaleFresh = await svc.enrich({
      full_name: 'Unticked Sale Empty Pool',
      owner_id: 57,
      lead_flow_kind: 'spa_operational',
      client_id: 'client-1',
    });
    expect(untickedSaleFresh.owner_id).toBeNull();
    expect(untickedSaleFresh.meta?.assign_override_from).toBe(57);
  });

  it('does not auto-assign a duplicate lead to an existing owner whose Nhan Lead is off', async () => {
    const dedupUnticked = {
      contactDedupeSince: jest.fn(async () => new Date('2026-09-13T00:00:00.000Z')),
      findByExternalId: jest.fn(async () => null),
      findContactDuplicates: jest.fn(async () => [
        { lead_id: 77, full_name: 'Cũ', phone: '0905556666', email: null, owner_id: 57 },
      ]),
    };
    const rulesWithQuery = {
      fetchClientIndustry: jest.fn(async () => null),
      fetchSnapshot: jest.fn(async () => null),
      query: jest.fn(async () => ({ rows: [] })),
    };
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedupUnticked as never,
      rulesWithQuery as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );

    const out = await svc.enrich({
      full_name: 'Dup Unticked',
      phone: '0905556666',
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
    });
    expect(out.is_duplicate).toBe(true);
    expect(out.owner_id).toBeNull();
    expect(out.meta?.assign_strategy).toBe('duplicate_owner_ineligible');
    expect(out.meta?.duplicate_ineligible_owner_id).toBe(57);
  });
});

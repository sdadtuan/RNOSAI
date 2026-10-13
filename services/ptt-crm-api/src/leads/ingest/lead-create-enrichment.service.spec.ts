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
  });
});

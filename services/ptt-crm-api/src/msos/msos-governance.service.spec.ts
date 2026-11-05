import { ForbiddenException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService exceptions scorecard eligibility', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const partnerId = '00000000-0000-4000-8000-000000000001';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      listOpenExceptions: jest.fn().mockResolvedValue([]),
      getExceptionSources: jest.fn().mockResolvedValue({
        calendarConflicts: [],
        liveUnofficial: [],
        makeGoodUnreserved: [],
        trafficRejected: [],
      }),
      syncDerivedExceptions: jest.fn(),
      getPartner: jest.fn().mockResolvedValue({ id: partnerId, kyc_pass: true }),
      getLatestScorecard: jest.fn().mockResolvedValue(null),
      getScorecardInputs: jest.fn().mockResolvedValue(null),
      upsertScorecard: jest.fn(),
      getEligibility: jest.fn().mockResolvedValue({
        partner_id: partnerId,
        kyc_pass: true,
        scorecard_pass: false,
        rate_published: true,
        reseller_open: false,
      }),
      upsertEligibility: jest.fn(),
      hasPublishedRateForPartner: jest.fn().mockResolvedValue(true),
      ...overrides,
    }) as unknown as MsosRepository;

  it('lists empty exceptions', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    await expect(svc.listExceptions()).resolves.toEqual([]);
  });

  it('rebuilds and lists derived exceptions', async () => {
    const syncDerivedExceptions = jest.fn();
    const listOpenExceptions = jest
      .fn()
      .mockResolvedValue([{ priority: 'P0', kind: 'capacity_conflict', open: true }]);
    const repo = makeRepo({
      getExceptionSources: jest.fn().mockResolvedValue({
        calendarConflicts: [{ placement_id: 'pl1', date: '2026-09-12' }],
        liveUnofficial: [],
        makeGoodUnreserved: [],
        trafficRejected: [],
      }),
      syncDerivedExceptions,
      listOpenExceptions,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.rebuildExceptions();
    expect(syncDerivedExceptions).toHaveBeenCalled();
    const out = await svc.listExceptions();
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns null scorecard when no data', async () => {
    const repo = makeRepo({
      getLatestScorecard: jest.fn().mockResolvedValue(null),
      getScorecardInputs: jest.fn().mockResolvedValue(null),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.getScorecard(partnerId)).resolves.toBeNull();
  });

  it('recomputes scorecard from real inputs', async () => {
    const upsertScorecard = jest.fn().mockImplementation(async (input) => ({
      partner_id: partnerId,
      score: input.score,
      delivery_bps: input.delivery_bps,
      discrepancy_bps: input.discrepancy_bps,
      safety_incidents: input.safety_incidents,
      computed_at: '2026-09-12T00:00:00Z',
    }));
    const repo = makeRepo({
      getScorecardInputs: jest.fn().mockResolvedValue({
        delivery_bps: 9500,
        discrepancy_bps: 200,
        safety_incidents: 0,
      }),
      upsertScorecard,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.recomputeScorecard(partnerId);
    expect(out?.score).toBe(91);
    expect(out?.score).not.toBe(74);
  });

  it('returns locked eligibility with reseller_open false', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    const out = await svc.getEligibility(partnerId);
    expect(out.reseller_open).toBe(false);
    expect(out.locked).toBe(true);
  });

  it('blocks POST to enable reseller', async () => {
    const svc = new MsosService(enabledConfig, makeRepo());
    await expect(svc.setEligibilityReseller(partnerId, true)).rejects.toMatchObject({
      response: { error: 'reseller_locked' },
    });
  });
});

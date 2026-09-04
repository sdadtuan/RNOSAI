import { BadRequestException } from '@nestjs/common';
import type { CommandCenterResponse } from '../command-center/command-center.builder';
import { KpiHubDashboardService } from './kpi-hub-dashboard.service';
import { KPI_HUB_ERROR_CODES } from '../kpi-hub.types';

function makeDashboardService(overrides?: {
  factsMap?: Map<string, number | null>;
  qualityScore?: number;
}) {
  const factsMap = overrides?.factsMap ?? new Map([['SAL_008', 1_240_000_000]]);
  const qualityScore = overrides?.qualityScore ?? 88;

  const facts = {
    getFactsMap: jest.fn(async () => factsMap),
  };

  const targets = {
    list: jest.fn(async () => ({
      items: [
        {
          id: 't1',
          dictionary_code: 'SAL_008',
          dictionary_name: 'Doanh thu kỳ mới',
          target_value: 1_200_000_000,
          warning_value: null,
          critical_value: null,
          direction: 'HIGHER_IS_BETTER',
          status: 'ACHIEVED',
        },
      ],
    })),
  };

  const quality = {
    getOverview: jest.fn(async () => ({
      score: qualityScore,
      critical_count: 0,
      freshness: [
        { system: 'CRM', status: 'FRESH', last_success_at: '2026-09-04T08:00:00+07:00' },
      ],
    })),
  };

  const alerts = {
    list: jest.fn(async () => ({ items: [] })),
  };

  const dictionary = {
    list: jest.fn(async () => ({ items: [] })),
  };

  const reports = {
    list: jest.fn(async () => ({ items: [] })),
  };

  const svc = new KpiHubDashboardService(
    facts as never,
    targets as never,
    quality as never,
    alerts as never,
    dictionary as never,
    reports as never,
  );

  return svc;
}

describe('KpiHubDashboardService command center', () => {
  it('persona executive returns six tiles and hidden forecast', async () => {
    const svc = makeDashboardService();
    const out = (await svc.getDashboard({ persona: 'executive', from: '2026-09-01', compare: '1' })) as CommandCenterResponse;
    expect(out.persona).toBe('executive');
    expect(out.tiles).toHaveLength(6);
    expect(out.series.forecast).toBeNull();
    expect(out.trust.score).toBe(88);
  });

  it('rejects unknown persona with KPI_HUB_CODE_INVALID', async () => {
    const svc = makeDashboardService();
    await expect(svc.getDashboard({ persona: 'finance' as never })).rejects.toMatchObject({
      response: { error: KPI_HUB_ERROR_CODES.CODE_INVALID },
    });
    await expect(svc.getDashboard({ persona: 'finance' as never })).rejects.toBeInstanceOf(BadRequestException);
  });
});

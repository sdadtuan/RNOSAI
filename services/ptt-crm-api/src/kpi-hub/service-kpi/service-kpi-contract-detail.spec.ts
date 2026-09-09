import { buildContractDetail } from './service-kpi-contract-detail';
import { evaluateKpiContractScore } from './service-kpi-contract-score';

describe('buildContractDetail', () => {
  it('builds SKPI-09 gate rows for blocked quote with GM + aggressive CPL', () => {
    const score = evaluateKpiContractScore({
      classificationRisk: 45,
      targetAggressiveness: 41,
      assumptionOpen: 50,
      dataReadinessGap: 0,
      marginPressure: 10,
      gmBps: 2240,
      gmFloorBps: 2500,
    });

    const detail = buildContractDetail({
      score,
      gmBps: 2240,
      gmFloorBps: 2500,
      industry: 'BĐS',
      classificationRisk: 45,
      targetAggressiveness: 41,
      assumptionOpen: 50,
      dataReadinessGap: 0,
      marginPressure: 10,
      instances: [
        {
          dictionary_id: 'MKT_006',
          classification: 'OPTIMIZATION_TARGET',
          target_min: 50000,
          target_max: 100000,
          assumption_state: 'pending',
          assumption_text: 'Budget 120tr',
          disclaimer_text: 'Forecast disclaimer',
          client_visible: true,
        },
      ],
    });

    expect(detail.blockSubmit).toBe(true);
    expect(detail.gate_rows.some((r) => r.label.includes('GM floor'))).toBe(true);
    expect(detail.gate_rows.some((r) => r.value.includes('Pending'))).toBe(true);
    expect(detail.trigger_summary).toContain('margin');
  });
});

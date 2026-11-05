import { KpiHubAlertEngineService } from './kpi-hub-alert-engine.service';

describe('kpi-hub-alert-engine', () => {
  const engine = new KpiHubAlertEngineService();

  beforeEach(() => {
    engine.clearDedupCache();
  });

  const baseCtx = {
    dictionary_id: 'd008',
    dictionary_code: 'MKT_008',
    scope_hash: 'c:bdsk3|t:sales-a|w:default',
    scope_label: 'Campaign BĐS Q3',
    period: '2026-09',
    actual: 24.8,
    threshold: 25,
  };

  it('fires ENTER_WARNING on status transition', () => {
    const result = engine.evaluateRule({
      rule: {
        id: 'ar-warn',
        dictionary_id: 'd008',
        condition: 'ENTER_WARNING',
        dedup_minutes: 240,
        enabled: true,
      },
      ...baseCtx,
      previous_status: 'ACHIEVED',
      current_status: 'WARNING',
    });
    expect(result.fired).toBe(true);
    expect(result.level).toBe('WARNING');
  });

  it('dedups repeated ENTER_WARNING within window', () => {
    const rule = {
      id: 'ar-warn',
      dictionary_id: 'd008',
      condition: 'ENTER_WARNING' as const,
      dedup_minutes: 240,
      enabled: true,
    };
    const now = new Date('2026-09-04T08:00:00Z');
    engine.evaluateRule({
      rule,
      ...baseCtx,
      previous_status: 'ACHIEVED',
      current_status: 'WARNING',
      now,
    });
    const second = engine.evaluateRule({
      rule,
      ...baseCtx,
      previous_status: 'ACHIEVED',
      current_status: 'WARNING',
      now: new Date('2026-09-04T08:30:00Z'),
    });
    expect(second.deduped).toBe(true);
    expect(second.fired).toBe(false);
  });

  it('severity upgrade bypasses dedup', () => {
    const warnRule = {
      id: 'ar-warn',
      dictionary_id: 'd008',
      condition: 'ENTER_WARNING' as const,
      dedup_minutes: 240,
      enabled: true,
    };
    const critRule = {
      id: 'ar-crit',
      dictionary_id: 'd008',
      condition: 'ENTER_CRITICAL' as const,
      dedup_minutes: 240,
      enabled: true,
    };
    const now = new Date('2026-09-04T08:00:00Z');
    engine.evaluateRule({
      rule: warnRule,
      ...baseCtx,
      previous_status: 'ACHIEVED',
      current_status: 'WARNING',
      now,
    });
    const crit = engine.evaluateRule({
      rule: critRule,
      ...baseCtx,
      previous_status: 'WARNING',
      current_status: 'CRITICAL',
      now: new Date('2026-09-04T08:15:00Z'),
    });
    expect(crit.fired).toBe(true);
    expect(crit.level).toBe('CRITICAL');
  });

  it('does not fire when status unchanged', () => {
    const result = engine.evaluateRule({
      rule: {
        id: 'ar-warn',
        dictionary_id: 'd008',
        condition: 'ENTER_WARNING',
        dedup_minutes: 240,
        enabled: true,
      },
      ...baseCtx,
      previous_status: 'WARNING',
      current_status: 'WARNING',
    });
    expect(result.fired).toBe(false);
  });
});

import {
  evaluateConsultReady,
  CONSULT_READY_UI_COPY,
  WINNING_PLAN_UI_COPY,
  OBSOLETE_CONSULT_FORMULAS,
  parseServiceStatus,
} from './ops-consult-ready.util';
import {
  resolveFieldStatus,
  statusSatisfiesGate,
  type FieldQualityMeta,
} from './ops-field-quality.util';

describe('evaluateConsultReady (P8)', () => {
  const confirmedPain: FieldQualityMeta = {
    status: 'assumed_confirmed',
    text: 'Cần lead ổn định từ Facebook Ads',
  };

  it('passes when BANT≥24 + pain confirmed + service confirmed + Go + session', () => {
    const out = evaluateConsultReady({
      bant_score: 24,
      qualify_decision: 'go',
      session_completed: true,
      pain: confirmedPain,
      service_status: 'recommended_confirmed',
    });
    expect(out.consult_ready).toBe(true);
    expect(out.blockers).toEqual([]);
    expect(out.ui_copy).toBe(CONSULT_READY_UI_COPY);
  });

  it('fails when pain is only assumed_draft', () => {
    const out = evaluateConsultReady({
      bant_score: 28,
      qualify_decision: 'go',
      session_completed: true,
      pain: { status: 'assumed_draft', text: 'muốn bán chạy' },
      service_status: 'selected',
    });
    expect(out.consult_ready).toBe(false);
    expect(out.blockers.map((b) => b.code)).toContain('pain_unconfirmed');
  });

  it('does not require TMMT≥9 (no obsolete formula in copy)', () => {
    expect(CONSULT_READY_UI_COPY).not.toMatch(/TMMT/);
    for (const bad of OBSOLETE_CONSULT_FORMULAS) {
      expect(CONSULT_READY_UI_COPY).not.toContain(bad);
    }
    expect(WINNING_PLAN_UI_COPY).toMatch(/6\/12/);
  });

  it('fails when needs_am_rework even if other gates ok', () => {
    const out = evaluateConsultReady({
      bant_score: 26,
      qualify_decision: 'go',
      session_completed: true,
      pain: { status: 'validated', text: 'Pain OK' },
      service_status: 'selected',
      needs_am_rework: true,
    });
    expect(out.consult_ready).toBe(false);
    expect(out.blockers.map((b) => b.code)).toContain('needs_am_rework');
  });
});

describe('field quality helpers', () => {
  it('legacy filled text without meta counts as validated', () => {
    const meta = resolveFieldStatus({ text: 'ICP SME spa' });
    expect(meta.status).toBe('validated');
    expect(statusSatisfiesGate(meta)).toBe(true);
  });

  it('parseServiceStatus defaults unknown', () => {
    expect(parseServiceStatus('selected')).toBe('selected');
    expect(parseServiceStatus('')).toBe('unknown');
  });
});

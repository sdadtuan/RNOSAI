import { validatePresalesConsultAdvance } from './presales-consult-gate.util';

const WIN_GATE_ENV = 'PTT_INTAKE_WIN_GATE';

const filledWinAnswers = {
  win_intel: {
    incumbent: { answer: 'Agency ABC đang làm', confidence: 'confirmed' },
    selection_criteria: { answer: 'Giá và SLA rõ', confidence: 'confirmed' },
    switch_risk: { answer: 'Hợp đồng khóa 12 tháng', confidence: 'confirmed' },
  },
  win_checklist: {
    incumbent: 3,
    competitor: 3,
    selection_criteria: 3,
    switch_risk: 3,
    champion: 3,
    next_step: 3,
  },
};

describe('validatePresalesConsultAdvance', () => {
  const originalWinGate = process.env[WIN_GATE_ENV];

  beforeEach(() => {
    delete process.env[WIN_GATE_ENV];
  });

  afterEach(() => {
    if (originalWinGate === undefined) delete process.env[WIN_GATE_ENV];
    else process.env[WIN_GATE_ENV] = originalWinGate;
  });

  it('blocks when lead task incomplete', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: false,
      sessions: [{ status: 'completed', decision: 'go', bant_total: 24 }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('task Lead');
  });

  it('blocks when no completed intake', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'draft', decision: '', bant_total: 0 }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('Lead Intake');
  });

  it('requires confirm on nurture decision', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'completed', decision: 'nurture', bant_total: 20 }],
    });
    expect(gate.ok).toBe(true);
    expect(gate.requires_confirm).toBe(true);
  });

  it('allows go with strong BANT', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'completed', decision: 'go', bant_total: 26 }],
    });
    expect(gate.ok).toBe(true);
    expect(gate.requires_confirm).toBe(false);
  });

  it('keeps Phase 1 lead-task block when Win gate on and answers empty', () => {
    process.env[WIN_GATE_ENV] = '1';
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: false,
      sessions: [{ status: 'completed', decision: 'go', bant_total: 26, answers_json: {} }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages.join(' ')).toContain('task Lead');
    expect(gate.messages.join(' ')).not.toMatch(/Win intel|Win /);
  });

  it('blocks go when Win gate on and answers empty', () => {
    process.env[WIN_GATE_ENV] = '1';
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'completed', decision: 'go', bant_total: 26, answers_json: {} }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages.join(' ')).toMatch(/Win intel|Win /);
  });

  it('allows go when Win gate on and required intel plus checklist 18', () => {
    process.env[WIN_GATE_ENV] = '1';
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [
        {
          status: 'completed',
          decision: 'go',
          bant_total: 26,
          answers_json: filledWinAnswers,
        },
      ],
    });
    expect(gate.ok).toBe(true);
    expect(gate.requires_confirm).toBe(false);
  });

  it('allows go when Win gate off and answers empty', () => {
    process.env[WIN_GATE_ENV] = '0';
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'completed', decision: 'go', bant_total: 26, answers_json: {} }],
    });
    expect(gate.ok).toBe(true);
  });
});

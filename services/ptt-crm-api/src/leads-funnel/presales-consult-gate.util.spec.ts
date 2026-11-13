import { validatePresalesConsultAdvance } from './presales-consult-gate.util';

const completeBrief = {
  discovery_brief: {
    company_name: 'Spa Hoa',
    industry: 'spa',
    flagship_product: 'Massage',
    contact_name: 'An',
    phone: '0901234567',
    services: ['ai-chatbot-ban-hang'],
    biggest_problem: '?t lead',
    marketing_goal: '30 lead/th?ng',
    target_customers: 'N? 25-45',
    region: 'TP.HCM',
    budget_band: '10_30',
    timeline_band: 'this_month',
    call_notes: 'G?i 10 ph?t',
    temperature: 'hot',
  },
};

describe('validatePresalesConsultAdvance', () => {
  it('blocks when lead task incomplete', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: false,
      sessions: [{ status: 'draft', answers_json: completeBrief }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('task Lead');
  });

  it('blocks when discovery is incomplete and there is no legacy completed session', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'draft', decision: '', bant_total: 0, answers_json: {} }],
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('Sales Discovery');
  });

  it('allows a completed Sales Discovery brief without BANT or WIN', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'draft', answers_json: completeBrief }],
    });
    expect(gate.ok).toBe(true);
    expect(gate.requires_confirm).toBe(false);
    expect(gate.requires_override).toBe(false);
  });

  it('allows a legacy completed BANT session without discovery fields (back-compat)', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [{ status: 'completed', decision: 'nurture', bant_total: 12, answers_json: {} }],
    });
    expect(gate.ok).toBe(true);
  });

  it('does not block No-Go or low BANT or missing Win intel', () => {
    const gate = validatePresalesConsultAdvance({
      leadTaskDone: true,
      sessions: [
        {
          status: 'completed',
          decision: 'no_go',
          bant_total: 4,
          answers_json: {},
        },
      ],
    });
    expect(gate.ok).toBe(true);
    expect(gate.messages.join(' ')).not.toMatch(/Win intel|Win |No-Go|BANT/);
  });
});

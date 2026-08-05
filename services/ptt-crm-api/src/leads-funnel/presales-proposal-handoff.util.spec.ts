import { buildPresalesProposalHandoff } from './presales-proposal-handoff.util';

describe('presales-proposal-handoff.util', () => {
  it('builds proposals href with slug and notes', () => {
    const handoff = buildPresalesProposalHandoff({
      leadId: 42,
      serviceSlug: 'lead-gen',
      customerId: 7,
      consultTask: {
        form_data: { goal: 'Full funnel' },
        ai_output: 'AI audit summary',
        notes: 'Note consult',
        is_done: true,
      },
    });
    expect(handoff.can_open).toBe(true);
    expect(handoff.service_slugs).toEqual(['lead-gen']);
    expect(handoff.proposals_href).toContain('customer_id=7');
    expect(handoff.proposals_href).toContain('service_slugs=lead-gen');
    expect(handoff.notes).toContain('AI audit summary');
  });

  it('blocks when consult task not done', () => {
    const handoff = buildPresalesProposalHandoff({
      leadId: 1,
      serviceSlug: 'dich-vu-aeo',
      customerId: null,
      consultTask: {
        form_data: {},
        ai_output: '',
        notes: '',
        is_done: false,
      },
    });
    expect(handoff.can_open).toBe(false);
    expect(handoff.block_reason).toMatch(/Hoàn thành task Consult/);
  });
});

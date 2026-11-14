import { acceptDueAt } from './business-hours.util';
import {
  briefSubmitDueAt,
  buildHandoffSlaView,
  classifySlaState,
  contractDueAt,
  formatSlaDueVi,
  negotiateDueAt,
  suggestedSolutionDueAt,
  resolveHandoffSlaRecipientIds,
  slaNotifyCopy,
  inferHandoffSlaStep,
  ceoApproveDueAt,
  customerResponseDueAt,
  revisionDueAt,
} from './handoff-sla.util';
import { solutionWorkDueAt } from './solution-case.util';

function ict(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 7 * 60 * 60 * 1000);
}

describe('solutionWorkDueAt cutoff 15:30 / 11:00', () => {
  it('before 15:30 adds 4 business hours', () => {
    const due = solutionWorkDueAt(ict(2026, 11, 11, 10, 0));
    expect(due.toISOString()).toBe(ict(2026, 11, 11, 14, 0).toISOString());
  });

  it('at or after 15:30 is 11:00 next business day', () => {
    const due = solutionWorkDueAt(ict(2026, 11, 11, 15, 30));
    expect(due.toISOString()).toBe(ict(2026, 11, 12, 11, 0).toISOString());
  });

  it('weekend is 11:00 next business day', () => {
    const due = solutionWorkDueAt(ict(2026, 11, 14, 11, 0));
    expect(due.toISOString()).toBe(ict(2026, 11, 16, 11, 0).toISOString());
  });
});

describe('7-step due helpers', () => {
  it('brief is +1 business day', () => {
    expect(briefSubmitDueAt(ict(2026, 11, 11, 10, 0)).toISOString()).toBe(
      ict(2026, 11, 12, 10, 0).toISOString(),
    );
  });

  it('negotiate is +3 business days, contract +5 from approval', () => {
    const approved = ict(2026, 11, 11, 11, 0);
    expect(negotiateDueAt(approved).toISOString()).toBe(ict(2026, 11, 16, 11, 0).toISOString());
    expect(contractDueAt(approved).toISOString()).toBe(ict(2026, 11, 18, 11, 0).toISOString());
  });

  it('suggestedSolutionDueAt matches cutoff rules', () => {
    expect(suggestedSolutionDueAt(ict(2026, 11, 11, 16, 0)).toISOString()).toBe(
      ict(2026, 11, 12, 11, 0).toISOString(),
    );
  });
});

describe('buildHandoffSlaView', () => {
  it('shows AM accept clock while pending', () => {
    const view = buildHandoffSlaView(
      {
        currentStep: 'await_solution',
        handoffStatus: 'pending',
        handedOffAt: ict(2026, 11, 11, 10, 0).toISOString(),
        solutionAcceptDueAt: acceptDueAt(ict(2026, 11, 11, 10, 0)).toISOString(),
      },
      ict(2026, 11, 11, 10, 5),
    );
    expect(view.current?.key).toBe('solution_accept');
    expect(view.current?.state).toBe('ok');
  });

  it('marks warning then breach for quote finish', () => {
    const accepted = ict(2026, 11, 11, 10, 0);
    const due = ict(2026, 11, 11, 12, 0);
    const soon = buildHandoffSlaView(
      {
        currentStep: 'await_quote',
        quoteAcceptedAt: accepted.toISOString(),
        quoteDueAt: due.toISOString(),
      },
      ict(2026, 11, 11, 11, 50),
    );
    expect(soon.current?.key).toBe('quote_finish');
    expect(soon.current?.state).toBe('warning');
    const late = buildHandoffSlaView(
      {
        currentStep: 'await_quote',
        quoteAcceptedAt: accepted.toISOString(),
        quoteDueAt: due.toISOString(),
      },
      ict(2026, 11, 11, 12, 1),
    );
    expect(late.current?.state).toBe('breach');
  });
});

describe('classify + format', () => {
  it('classifies warning inside the window', () => {
    const now = ict(2026, 11, 11, 10, 0);
    const due = ict(2026, 11, 11, 10, 2);
    expect(classifySlaState(due, now, 3 * 60_000)).toBe('warning');
  });

  it('formats due time in vi-VN without seconds', () => {
    const label = formatSlaDueVi(ict(2026, 11, 18, 18, 0).toISOString());
    expect(label).toBe('18:00 18/11/2026');
    expect(label).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});


describe('resolveHandoffSlaRecipientIds', () => {
  const amDesk = [108, 1, 103];
  const ceoDesk = [200, 1];

  it('sends unclaimed pending AM accept clocks to the AM desk pool', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'solution_accept',
        amDeskStaffIds: amDesk,
        ceoDeskStaffIds: ceoDesk,
      }).sort((a, b) => a - b),
    ).toEqual([1, 103, 108]);
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'quote_accept',
        amDeskStaffIds: amDesk,
      }).sort((a, b) => a - b),
    ).toEqual([1, 103, 108]);
  });

  it('sends a claimed AM clock to the assignee, not the whole pool', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'quote_accept',
        quoteAssigneeStaffId: 108,
        amDeskStaffIds: amDesk,
      }),
    ).toEqual([108]);
  });

  it('sends Marketing clocks to the solution owner, or the AM pool when unowned', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'Marketing',
        clockKey: 'solution_work',
        solutionOwnerStaffId: 55,
        amDeskStaffIds: amDesk,
      }),
    ).toEqual([55]);
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'Marketing',
        clockKey: 'solution_work',
        amDeskStaffIds: amDesk,
      }).sort((a, b) => a - b),
    ).toEqual([1, 103, 108]);
  });

  it('sends Sales clocks to lead owner_id only', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'Sales',
        clockKey: 'sales_brief',
        ownerId: 107,
        amDeskStaffIds: amDesk,
        ceoDeskStaffIds: ceoDesk,
      }),
    ).toEqual([107]);
  });

  it('sends CEO clocks to ceoDeskStaffIds', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'CEO',
        clockKey: 'ceo_approve',
        amDeskStaffIds: amDesk,
        ceoDeskStaffIds: ceoDesk,
      }).sort((a, b) => a - b),
    ).toEqual([1, 200]);
  });

  it('sends negotiate and contract clocks to the AM owner plus SUPER-ADMIN', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'negotiate',
        quoteAssigneeStaffId: 108,
        amDeskStaffIds: amDesk,
        superAdminStaffIds: [1],
      }).sort((a, b) => a - b),
    ).toEqual([1, 108]);
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'contract',
        amDeskStaffIds: amDesk,
        superAdminStaffIds: [1],
      }).sort((a, b) => a - b),
    ).toEqual([1]);
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'negotiate',
        amDeskStaffIds: amDesk,
      }).sort((a, b) => a - b),
    ).toEqual([1, 103, 108]);
  });

  it('drops invalid ids and de-duplicates the desk pool', () => {
    expect(
      resolveHandoffSlaRecipientIds({
        role: 'AM',
        clockKey: 'solution_accept',
        amDeskStaffIds: [108, 108, 0, -1, Number.NaN],
      }),
    ).toEqual([108]);
  });
});


describe('negotiate and contract clocks from CEO approval', () => {
  const approved = ict(2026, 11, 11, 11, 0);
  const now = ict(2026, 11, 12, 10, 0);

  it('computes negotiate (3 business days) and contract (5) even without stored dues', () => {
    const view = buildHandoffSlaView(
      {
        leadStatus: 'dam_phan',
        quoteApprovedAt: approved.toISOString(),
      },
      now,
    );
    const negotiate = view.clocks.find((c) => c.key === 'negotiate');
    const contract = view.clocks.find((c) => c.key === 'contract');
    expect(negotiate?.due_at).toBe(negotiateDueAt(approved).toISOString());
    expect(contract?.due_at).toBe(contractDueAt(approved).toISOString());
    expect(view.current?.key).toBe('negotiate');
    expect(negotiate?.due_label).toBe(formatSlaDueVi(negotiateDueAt(approved).toISOString()));
    expect(negotiate?.due_label).toMatch(/^\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/);
  });

  it('hides the negotiate clock and shows contract after the lead moves to chot', () => {
    const view = buildHandoffSlaView(
      {
        leadStatus: 'chot',
        quoteApprovedAt: approved.toISOString(),
      },
      now,
    );
    expect(view.clocks.some((c) => c.key === 'negotiate')).toBe(false);
    expect(view.current?.key).toBe('contract');
  });

  it('inferHandoffSlaStep maps dam_phan / quote approved to negotiate and chot to contract', () => {
    expect(inferHandoffSlaStep({ leadStatus: 'dam_phan', quoteApprovedAt: approved.toISOString() })).toBe('negotiate');
    expect(inferHandoffSlaStep({ quoteApprovedAt: approved.toISOString() })).toBe('negotiate');
    expect(inferHandoffSlaStep({ leadStatus: 'chot', quoteApprovedAt: approved.toISOString() })).toBe('contract');
  });
});

describe('slaNotifyCopy', () => {
  it('omits the raw open-lead path and uses HH:mm dd/MM/yyyy with no seconds', () => {
    const approved = ict(2026, 11, 11, 11, 0);
    const view = buildHandoffSlaView(
      { leadStatus: 'dam_phan', quoteApprovedAt: approved.toISOString() },
      ict(2026, 11, 12, 10, 0),
    );
    const clock = view.clocks.find((c) => c.key === 'negotiate');
    expect(clock).toBeTruthy();
    const copy = slaNotifyCopy(clock!, 900000136);
    expect(copy.body).not.toMatch(/Mở lead:/);
    expect(copy.body).not.toMatch(/\/crm\/leads\//);
    expect(copy.body).toMatch(/hạn \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/);
    expect(copy.body).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(copy.title).toMatch(/^SLA /);
  });
});

describe('business-hours revision / customer / CEO clocks (Mon–Fri 08:30–18:30)', () => {
  // 13/11/2026 is a Friday.
  it('Fri 17:30 + 2h revision lands Mon 09:30', () => {
    expect(revisionDueAt(ict(2026, 11, 13, 17, 30)).toISOString()).toBe(ict(2026, 11, 16, 9, 30).toISOString());
  });

  it('Fri 16:00 + 8h customer response lands Mon 14:00', () => {
    expect(customerResponseDueAt(ict(2026, 11, 13, 16, 0)).toISOString()).toBe(
      ict(2026, 11, 16, 14, 0).toISOString(),
    );
  });

  it('Fri 17:00 + 24 business hours CEO approval lands Wed 11:00 (never a night or weekend)', () => {
    // Fri 1.5h + Mon 10h + Tue 10h + Wed 2.5h.
    expect(ceoApproveDueAt(ict(2026, 11, 13, 17, 0)).toISOString()).toBe(ict(2026, 11, 18, 11, 0).toISOString());
  });

  it('a release after hours starts counting at 08:30 next working day', () => {
    expect(customerResponseDueAt(ict(2026, 11, 14, 19, 26)).toISOString()).toBe(
      ict(2026, 11, 16, 16, 30).toISOString(),
    );
  });

  it('quote_accept started_at is the offer time; missing_info / revision have no fake start', () => {
    const view = buildHandoffSlaView(
      {
        handoffStatus: 'with_solution',
        solutionRevisionDueAt: ict(2026, 11, 16, 10, 0).toISOString(),
        quoteOfferedAt: ict(2026, 11, 16, 9, 0).toISOString(),
        quoteAcceptDueAt: ict(2026, 11, 16, 9, 15).toISOString(),
      },
      ict(2026, 11, 16, 9, 5),
    );
    const byKey = Object.fromEntries(view.clocks.map((c) => [c.key, c]));
    expect(byKey.solution_revision.started_at).toBeNull();
    expect(byKey.quote_accept.started_at).toBe(ict(2026, 11, 16, 9, 0).toISOString());
  });
});

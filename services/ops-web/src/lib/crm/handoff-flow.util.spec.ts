import { describe, expect, it } from 'vitest';
import {
  HANDOFF_FLOW_STEPS,
  SOLUTION_RELEASE_LEAD_STATUS,
  amDeskChecklist,
  bucketLeadsByHandoffFlow,
  dash,
  handoffFlowStatusLabel,
  kanbanColumnIdForLead,
  leadStatusAfterSolutionRelease,
  resolveHandoffFlow,
  resolveHandoffFlowStep,
  salesDeskSideMode,
  timestampsForHandoffFlow,
  flowTimesFromFunnel,
  formatHandoffStamp,
  splitBriefIdeas,
  visibleHandoffFlowSteps,
  isQuoteApproved,
  isQuoteAwaitingCeo,
  withSubmittedToCeoFlowInput,
} from './handoff-flow.util';

describe('handoff-flow.util', () => {
  it('defines seven steps in the agreed order', () => {
    expect(HANDOFF_FLOW_STEPS.map((s) => s.label)).toEqual([
      'Tiếp nhận Lead',
      'Sales tư vấn & nhập Brief',
      'Chờ Solutions',
      'AM làm Solution',
      'Chờ báo giá',
      'Chờ CEO duyệt',
      'Ký hợp đồng',
    ]);
  });

  it('maps a fresh lead to Tiếp nhận Lead', () => {
    expect(resolveHandoffFlowStep({ leadStatus: 'moi' })).toBe('receive_lead');
    expect(handoffFlowStatusLabel({ leadStatus: 'moi' })).toBe('Tiếp nhận Lead');
  });

  it('opens Pre Sale (Sales Brief) after first contact', () => {
    expect(resolveHandoffFlowStep({ leadStatus: 'da_lien_he' })).toBe('sales_brief');
    expect(resolveHandoffFlowStep({ leadStatus: 'dang_tu_van' })).toBe('sales_brief');
  });

  it('uses handoff pending as Chờ Solutions even if status is still Đang tư vấn', () => {
    expect(
      resolveHandoffFlowStep({
        leadStatus: 'dang_tu_van',
        handoffStatus: 'pending',
        discoverySubmitted: true,
      }),
    ).toBe('await_solutions');
    expect(
      handoffFlowStatusLabel({ leadStatus: 'dang_tu_van', handoffStatus: 'pending' }),
    ).toBe('Chờ Solutions');
  });

  it('maps with_solution to AM làm Solution', () => {
    expect(
      resolveHandoffFlowStep({ leadStatus: 'dang_tu_van', handoffStatus: 'with_solution' }),
    ).toBe('doing_solutions');
  });

  it('maps released / bao_gia to Chờ báo giá (the release bug fix)', () => {
    expect(
      resolveHandoffFlowStep({ leadStatus: 'dang_tu_van', handoffStatus: 'released' }),
    ).toBe('await_quote');
    expect(resolveHandoffFlowStep({ leadStatus: 'bao_gia', handoffStatus: 'released' })).toBe(
      'await_quote',
    );
    expect(
      resolveHandoffFlowStep({
        leadStatus: 'bao_gia',
        handoffStatus: 'released',
        quotePhase: 'ceo_review',
      }),
    ).toBe('negotiate');
    expect(
      resolveHandoffFlowStep({
        leadStatus: 'bao_gia',
        handoffStatus: 'released',
        quoteSentBackAt: '2026-11-16T06:15:04.000Z',
      }),
    ).toBe('negotiate');
    const submitted = resolveHandoffFlow({
      leadStatus: 'bao_gia',
      handoffStatus: 'released',
      quoteSentBackAt: '2026-11-16T06:15:04.000Z',
    });
    const submittedVisible = visibleHandoffFlowSteps(submitted);
    expect(submittedVisible.currentKey).toBe('negotiate');
    expect(submittedVisible.steps.find((step) => step.key === 'await_quote')?.state).toBe('done');
    expect(submittedVisible.steps.find((step) => step.key === 'negotiate')?.state).toBe('current');
    expect(submittedVisible.steps.find((step) => step.key === 'negotiate')?.isActive).toBe(true);
    expect(submittedVisible.steps.find((step) => step.key === 'negotiate')?.index).toBe(5);
    const fromSheetSignal = visibleHandoffFlowSteps(
      resolveHandoffFlow(
        withSubmittedToCeoFlowInput(
          { leadStatus: 'bao_gia', handoffStatus: 'released' },
          true,
        ),
      ),
    );
    expect(fromSheetSignal.currentKey).toBe('negotiate');
    expect(fromSheetSignal.steps.find((step) => step.key === 'await_quote')?.state).toBe('done');
    expect(fromSheetSignal.steps.find((step) => step.key === 'negotiate')?.state).toBe('current');
    expect(fromSheetSignal.steps.find((step) => step.key === 'negotiate')?.isActive).toBe(true);
    expect(fromSheetSignal.steps.find((step) => step.key === 'negotiate')?.index).toBe(5);

    expect(isQuoteAwaitingCeo({ quotePhase: 'bao_gia', quoteSentBackAt: '2026-11-16T09:04:10.856Z' })).toBe(true);
    expect(isQuoteAwaitingCeo({ quotePhase: 'ceo_review', quoteApprovedAt: '' })).toBe(true);
    expect(isQuoteAwaitingCeo({ quotePhase: 'bao_gia' }, true)).toBe(true);
    expect(isQuoteAwaitingCeo({ quotePhase: 'bao_gia', submittedForCeo: true })).toBe(true);
    expect(isQuoteApproved({ quotePhase: 'hop_dong' })).toBe(true);
    expect(isQuoteAwaitingCeo({ quotePhase: 'hop_dong', quoteSentBackAt: '2026-11-16T09:04:10.856Z' })).toBe(false);
    expect(isQuoteAwaitingCeo({ quotePhase: 'ceo_review', quoteApprovedAt: '2026-11-16T10:00:00.000Z' })).toBe(false);
    expect(isQuoteAwaitingCeo({ quotePhase: 'bao_gia' })).toBe(false);
    expect(
      resolveHandoffFlowStep({
        leadStatus: 'bao_gia',
        handoffStatus: 'released',
        quoteSentBackAt: '2026-11-16T06:15:04.000Z',
        quoteApprovedAt: '2026-11-16T07:00:00.000Z',
        quotePhase: 'hop_dong',
        contractCreatedAt: '2026-11-16T07:05:00.000Z',
      }),
    ).toBe('sign_contract');
    expect(handoffFlowStatusLabel({ leadStatus: 'bao_gia' })).toBe('Chờ báo giá');
  });

  it('maps negotiation and signed contract to the last two steps', () => {
    expect(resolveHandoffFlowStep({ leadStatus: 'dam_phan' })).toBe('negotiate');
    expect(resolveHandoffFlowStep({ leadStatus: 'won', hasContract: true })).toBe('sign_contract');
  });

  it('moves leftover dam_phan / bao_gia to Ký hợp đồng once CEO has approved the quote', () => {
    expect(resolveHandoffFlowStep({ leadStatus: 'dam_phan', quotePhase: 'hop_dong' })).toBe('sign_contract');
    expect(resolveHandoffFlowStep({ leadStatus: 'bao_gia', quotePhase: 'hop_dong' })).toBe('sign_contract');
    expect(
      resolveHandoffFlowStep({ leadStatus: 'dam_phan', quoteApprovedAt: '2026-11-16T07:00:00.000Z' }),
    ).toBe('sign_contract');
    expect(resolveHandoffFlowStep({ leadStatus: 'chot', quotePhase: 'hop_dong' })).toBe('sign_contract');
    expect(resolveHandoffFlowStep({ leadStatus: 'bao_gia', quotePhase: 'trien_khai' })).toBe('trien_khai');
    expect(resolveHandoffFlowStep({ leadStatus: 'trien_khai', hasContract: true, contractStatus: 'active' })).toBe(
      'trien_khai',
    );
  });

  it('returns a lead to Sales Brief after AM trả về Sales', () => {
    expect(
      resolveHandoffFlowStep({
        leadStatus: 'dang_tu_van',
        handoffStatus: 'returned',
        returnedToSales: true,
        discoverySubmitted: true,
      }),
    ).toBe('sales_brief');
  });

  it('marks earlier steps done and later steps pending', () => {
    const view = resolveHandoffFlow({
      leadStatus: 'dang_tu_van',
      handoffStatus: 'pending',
      leadCreatedAt: '2026-11-13T03:00:00.000Z',
      handedOffAt: '2026-11-13T10:55:00.000Z',
    });
    expect(view.currentKey).toBe('await_solutions');
    expect(view.steps[0].state).toBe('done');
    expect(view.steps[1].state).toBe('done');
    expect(view.steps[2].state).toBe('current');
    expect(view.steps[3].state).toBe('pending');
    expect(view.steps[0].at).toBeTruthy();
  });

  it('promotes Đang tư vấn to bao_gia on Solution release, and leaves won/lost alone', () => {
    expect(leadStatusAfterSolutionRelease('dang_tu_van')).toBe(SOLUTION_RELEASE_LEAD_STATUS);
    expect(leadStatusAfterSolutionRelease('hen_gap')).toBe('bao_gia');
    expect(leadStatusAfterSolutionRelease('won')).toBeNull();
    expect(leadStatusAfterSolutionRelease('lost')).toBeNull();
    expect(leadStatusAfterSolutionRelease('bao_gia')).toBeNull();
    expect(SOLUTION_RELEASE_LEAD_STATUS).toBe('bao_gia');
  });

  it('buckets Kanban rows by handoff so pending leaves Đang tư vấn', () => {
    const rows = [
      { id: 1, status: 'moi' },
      { id: 2, status: 'dang_tu_van' },
      { id: 3, status: 'dang_tu_van', solution_handoff: 'pending' },
      { id: 4, status: 'dang_tu_van', solution_handoff: 'with_solution' },
      { id: 5, status: 'dang_tu_van', solution_handoff: 'released' },
      { id: 6, status: 'bao_gia', solution_handoff: 'released' },
      { id: 7, status: 'dam_phan' },
      { id: 8, status: 'won', has_contract: true },
    ];
    expect(kanbanColumnIdForLead(rows[2])).toBe('cho_solutions');
    expect(kanbanColumnIdForLead(rows[3])).toBe('dang_lam_solutions');
    expect(kanbanColumnIdForLead(rows[4])).toBe('bao_gia');
    expect(kanbanColumnIdForLead(rows[1])).toBe('sales_brief');
    const bucketed = bucketLeadsByHandoffFlow(rows);
    expect(bucketed.byStage.cho_solutions.map((r) => r.id)).toEqual([3]);
    expect(bucketed.byStage.dang_lam_solutions.map((r) => r.id)).toEqual([4]);
    expect(bucketed.byStage.bao_gia.map((r) => r.id)).toEqual([5, 6]);
    expect(bucketed.byStage.dam_phan.map((r) => r.id)).toEqual([7]);
    expect(bucketed.byStage.won.map((r) => r.id)).toEqual([8]);
  });

  it('auto-checks the AM desk checklist from Discovery completeness', () => {
    const incomplete = amDeskChecklist({ company_name: 'Panda', industry: 'F&B' });
    expect(incomplete.allOk).toBe(false);
    expect(incomplete.items[0].ok).toBe(true);
    expect(incomplete.items[1].ok).toBe(false);

    const complete = amDeskChecklist({
      company_name: 'Panda Tea',
      industry: 'F&B',
      contact_name: 'Thảo',
      phone: '0909',
      biggest_problem: 'CPA cao',
      services: ['meta-ads'],
      marketing_goal: '30 lead/tháng',
      target_customers: 'VP nhân viên',
      budget_band: '10_30',
      timeline_band: 'this_month',
    });
    expect(complete.allOk).toBe(true);
    expect(complete.items.every((i) => i.ok)).toBe(true);
  });

  it('does not tick "Đủ điều kiện làm Solution" when a legacy lead is missing goal or budget', () => {
    const legacy = amDeskChecklist(
      {
        company_name: 'Công ty Seed 915',
        industry: 'Dịch vụ',
        contact_name: 'Phạm Hà 920915',
        phone: '0900000915',
        biggest_problem: 'Chăm sóc fanpage',
        services: ['ads'],
      },
      { legacyReady: true },
    );
    expect(legacy.items[0].ok).toBe(true);
    expect(legacy.items[1].ok).toBe(true);
    expect(legacy.items[2].ok).toBe(false);
    expect(legacy.items[3].ok).toBe(false);
    expect(legacy.items[4].ok).toBe(false);
    expect(legacy.allOk).toBe(false);
    expect(legacy.legacyAssignable).toBe(true);
  });

  it('renders a dash for missing Discovery fields instead of inventing data', () => {
    expect(dash('')).toBe('—');
    expect(dash(null)).toBe('—');
    expect(dash('  TP.HCM ')).toBe('TP.HCM');
  });

  it('fills stepper timestamps for every completed stage, including quote and contract', () => {
    const times = timestampsForHandoffFlow({
      leadCreatedAt: '2026-11-10T03:00:00.000Z',
      leadReceivedAt: '2026-11-10T03:05:00.000Z',
      discoverySubmittedAt: '2026-11-11T02:00:00.000Z',
      handedOffAt: '2026-11-11T02:00:00.000Z',
      solutionClaimedAt: '2026-11-12T01:00:00.000Z',
      solutionReleasedAt: '2026-11-13T04:30:00.000Z',
      quoteApprovedAt: '2026-11-14T08:00:00.000Z',
      contractCreatedAt: '2026-11-15T09:00:00.000Z',
    });
    expect(times.receive_lead).toBe('2026-11-10T03:05:00.000Z');
    expect(times.sales_brief).toBe('2026-11-11T02:00:00.000Z');
    expect(times.await_solutions).toBe('2026-11-11T02:00:00.000Z');
    expect(times.doing_solutions).toBe('2026-11-12T01:00:00.000Z');
    expect(times.await_quote).toBe('2026-11-13T04:30:00.000Z');
    expect(times.negotiate).toBe('2026-11-14T08:00:00.000Z');
    expect(times.sign_contract).toBe('2026-11-15T09:00:00.000Z');
  });

  it('formats stamps in Asia/Saigon with vi-VN day-month-year, never US month-first', () => {
    // 2026-11-13T17:00:00Z = 13/11/2026 00:00 in Saigon (+7) on the 14th 00:00
    const text = formatHandoffStamp('2026-11-13T17:05:00.000Z');
    expect(text).toMatch(/14\/11\/2026/);
    expect(text).toMatch(/00:05/);
    expect(text).not.toMatch(/11\/14\/2026/);
    expect(text).not.toMatch(/T17/);
  });


  it('picks Sales desk side contents by flow step', () => {
    expect(salesDeskSideMode('receive_lead')).toBe('notes');
    expect(salesDeskSideMode('sales_brief')).toBe('brief');
    expect(salesDeskSideMode('await_solutions')).toBe('stage');
    expect(salesDeskSideMode('doing_solutions')).toBe('stage');
    expect(salesDeskSideMode('await_quote')).toBe('stage');
    expect(salesDeskSideMode('negotiate')).toBe('stage');
    expect(salesDeskSideMode('sign_contract')).toBe('stage');
    expect(salesDeskSideMode('await_solutions', true)).toBe('brief');
  });

  it('reads release / quote / contract times from the funnel handoff payload', () => {
    const pulled = flowTimesFromFunnel({
      presales: {
        handoff: {
          handed_off_at: '2026-11-11T02:00:00.000Z',
          solution_claimed_at: '2026-11-12T01:00:00.000Z',
          solution_released_at: '2026-11-13T04:30:00.000Z',
          quote_approved_at: '2026-11-14T08:00:00.000Z',
          contract_created_at: '2026-11-15T09:00:00.000Z',
        },
      },
    });
    expect(pulled.solutionReleasedAt).toBe('2026-11-13T04:30:00.000Z');
    expect(pulled.quoteApprovedAt).toBe('2026-11-14T08:00:00.000Z');
    expect(pulled.contractCreatedAt).toBe('2026-11-15T09:00:00.000Z');
  });
});

describe('splitBriefIdeas', () => {
  it('keeps a single idea as one line', () => {
    expect(splitBriefIdeas('Tăng lead qualifi')).toEqual(['Tăng lead qualifi']);
  });

  it('splits newlines, semicolons, and sentences into bullets', () => {
    expect(splitBriefIdeas('Tăng lead.\nGiảm CPA')).toEqual(['Tăng lead.', 'Giảm CPA']);
    expect(splitBriefIdeas('Tăng lead; giảm CPA; giữ brand')).toEqual(['Tăng lead', 'giảm CPA', 'giữ brand']);
    expect(splitBriefIdeas('Tăng lead. Giảm CPA.')).toEqual(['Tăng lead.', 'Giảm CPA.']);
  });

  it('does not drop text', () => {
    const raw = 'Mục A; mục B';
    expect(splitBriefIdeas(raw).join(' ')).toContain('Mục A');
    expect(splitBriefIdeas(raw).join(' ')).toContain('mục B');
  });

  it('hides doing_solutions on the new path so the stepper shows 7 steps', () => {
    const view = resolveHandoffFlow({
      leadStatus: 'dang_tu_van',
      handoffStatus: 'pending',
    });
    expect(view.currentKey).toBe('await_solutions');
    const visible = visibleHandoffFlowSteps(view);
    expect(visible.steps.map((s) => s.key)).toEqual([
      'receive_lead',
      'sales_brief',
      'await_solutions',
      'await_quote',
      'negotiate',
      'sign_contract',
      'trien_khai',
    ]);
    expect(visible.steps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(visible.steps.some((s) => s.key === 'doing_solutions')).toBe(false);
  });

  it('keeps doing_solutions visible for legacy leads already on that step', () => {
    const view = resolveHandoffFlow({
      leadStatus: 'dang_tu_van',
      handoffStatus: 'with_solution',
    });
    expect(view.currentKey).toBe('doing_solutions');
    const visible = visibleHandoffFlowSteps(view);
    expect(visible.steps.some((s) => s.key === 'doing_solutions')).toBe(true);
    expect(visible.steps).toHaveLength(8);
  });
});

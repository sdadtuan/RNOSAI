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
} from './handoff-flow.util';

describe('handoff-flow.util', () => {
  it('defines seven steps in the agreed order', () => {
    expect(HANDOFF_FLOW_STEPS.map((s) => s.label)).toEqual([
      'Tiếp nhận Lead',
      'Sales tư vấn & nhập Brief',
      'Chờ Solutions',
      'Đang làm Solutions',
      'Chờ báo giá',
      'Thương thảo',
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

  it('maps with_solution to Đang làm Solutions', () => {
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
    expect(handoffFlowStatusLabel({ leadStatus: 'bao_gia' })).toBe('Chờ báo giá');
  });

  it('maps negotiation and signed contract to the last two steps', () => {
    expect(resolveHandoffFlowStep({ leadStatus: 'dam_phan' })).toBe('negotiate');
    expect(resolveHandoffFlowStep({ leadStatus: 'won', hasContract: true })).toBe('sign_contract');
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

  it('renders a dash for missing Discovery fields instead of inventing data', () => {
    expect(dash('')).toBe('—');
    expect(dash(null)).toBe('—');
    expect(dash('  TP.HCM ')).toBe('TP.HCM');
  });
});

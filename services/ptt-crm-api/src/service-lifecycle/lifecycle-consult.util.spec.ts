import {
  buildConsultBrief,
  buildLatestIntakeSummary,
  consultGateLevel,
  prefillConsultTaskForm,
  reconcileAiSummaryWithLiveBant,
} from './lifecycle-consult.util';
import type { IntakeSessionRow } from '../intake/intake.types';

function sessionFixture(overrides: Partial<IntakeSessionRow> = {}): IntakeSessionRow {
  return {
    id: 12,
    lead_id: 5,
    lifecycle_id: 1,
    mode: 'phone',
    status: 'completed',
    service_slug: 'quang-cao-facebook',
    contact_name: 'Test',
    bant_json: {},
    bant_total: 30,
    decision: 'go',
    decision_reason: 'Đủ ngân sách',
    answers_json: {},
    stakeholders_json: [],
    commitments_json: [],
    ai_summary: '',
    next_meeting_at: '',
    proposal_date: '',
    lead_temperature: 'hot',
    completed_at: '2026-09-20T00:00:00Z',
    created_at: '',
    updated_at: '',
    ...overrides,
  } as IntakeSessionRow;
}

describe('lifecycle-consult.util', () => {
  it('consultGateLevel blocks no_go', () => {
    expect(consultGateLevel('no_go', 26)).toBe('block');
  });

  it('consultGateLevel ok for go with high BANT', () => {
    expect(consultGateLevel('go', 26)).toBe('ok');
  });

  it('buildLatestIntakeSummary prefers live BANT over stale ai_summary 0/30', () => {
    const summary = buildLatestIntakeSummary(
      sessionFixture({
        bant_total: 30,
        decision: 'go',
        ai_summary: 'BANT 0/30 · DV quang-cao-facebook',
      }),
    );
    expect(summary).toContain('BANT: 30/30');
    expect(summary).not.toMatch(/BANT:?\s*0\/30/i);
    expect(summary).toContain('quang-cao-facebook');
  });

  it('reconcileAiSummaryWithLiveBant rewrites frozen 0/30', () => {
    expect(reconcileAiSummaryWithLiveBant('BANT 0/30 · DV quang-cao-facebook', 30, 'go')).toBe(
      'BANT 30/30 · DV quang-cao-facebook',
    );
  });

  it('buildConsultBrief latest_intake_summary uses live BANT', () => {
    const brief = buildConsultBrief({
      lifecycleId: 1,
      serviceSlug: 'quang-cao-facebook',
      leadId: 5,
      leadTaskDone: true,
      leadTask: { task_id: 1, form_data: { need: 'Ads' }, notes: '', is_done: true },
      intakeSessions: [
        sessionFixture({
          ai_summary: 'BANT 0/30 · DV quang-cao-facebook',
        }),
      ],
    });
    expect((brief.readiness as { bant_total: number }).bant_total).toBe(30);
    expect(String(brief.latest_intake_summary)).toContain('BANT: 30/30');
    expect(String(brief.latest_intake_summary)).not.toMatch(/BANT:?\s*0\/30/i);
  });

  it('buildConsultBrief without intake suggests intake action', () => {
    const brief = buildConsultBrief({
      lifecycleId: 1,
      serviceSlug: 'dich-vu-seo-tong-the',
      leadId: 10,
      leadTaskDone: false,
      leadTask: { task_id: 1, form_data: { need: 'Cần SEO' }, notes: '', is_done: false },
      intakeSessions: [],
    });
    expect(brief.service_label).toBe('SEO Tổng thể');
    expect((brief.recommended_actions as string[])[0]).toContain('Lead Intake');
  });

  it('prefillConsultTaskForm fills from lead need', () => {
    const out = prefillConsultTaskForm({
      serviceSlug: 'dich-vu-seo-tong-the',
      consultTask: {
        id: 2,
        lifecycle_id: 1,
        stage: 'consult',
        step_index: 0,
        title: 'Consult',
        description: '',
        form_fields: [],
        form_data: {},
        ai_prompt_key: '',
        ai_output: '',
        is_done: false,
        done_at: '',
        done_by: null,
        notes: '',
        is_custom: false,
        created_at: '',
        updated_at: '',
        assignee: null,
        assignee_staff_id: null,
        priority: 'normal',
        due_date: null,
      },
      leadTask: {
        id: 1,
        lifecycle_id: 1,
        stage: 'lead',
        step_index: 0,
        title: 'Lead',
        description: '',
        form_fields: [],
        form_data: { need: 'Traffic tụt', domain: 'example.com' },
        ai_prompt_key: '',
        ai_output: '',
        is_done: false,
        done_at: '',
        done_by: null,
        notes: '',
        is_custom: false,
        created_at: '',
        updated_at: '',
        assignee: null,
        assignee_staff_id: null,
        priority: 'normal',
        due_date: null,
      },
      latestIntake: null,
      overwrite: false,
    });
    expect(out.filled).toContain('current_status');
    expect(String(out.form_data.current_status)).toContain('Traffic');
  });
});

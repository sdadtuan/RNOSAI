import {
  buildSolutionHandoffActivity,
  SOLUTION_HANDOFF_ACTIVITY_TYPES,
} from './presales-solution-handoff-activity.util';

describe('presales-solution-handoff-activity.util', () => {
  const base = {
    leadId: 42,
    serviceSlug: 'seo',
    actorName: 'Nguyễn A',
  };

  it('builds handoff activity for AM', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff, base);
    expect(out.activity_type).toBe('solution_handoff');
    expect(out.content).toContain('Nguyễn A');
    expect(out.content).toContain('lead #42');
    expect(out.content).toContain('(seo)');
    expect(out.next_action).toContain('/crm/solution/queue');
  });

  it('builds claimed activity', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed, base);
    expect(out.activity_type).toBe('solution_claimed');
    expect(out.result).toContain('Consult + R5');
  });

  // AM makes the Solution and submits it straight to Sales (Tú 14/11/2026).
  it('builds released activity: AM nộp Solution cho Sales, Sales gets the next action', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.released, {
      ...base,
      actorName: 'Trần B',
      amOwnerName: 'Trần B',
    });
    expect(out.activity_type).toBe('solution_released');
    expect(out.content).toBe('Trần B · Nộp Solution cho Sales');
    expect(out.result).toContain('Sales lấy phản hồi khách');
    expect(out.next_action).toBe('Sales xem Solution và lấy phản hồi khách');
  });

  it('builds a return activity Sales can see as cần chỉnh', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.returned, {
      ...base,
      returnReason: 'Thiếu ngân sách và người quyết định',
    });
    expect(out.activity_type).toBe('solution_returned');
    expect(out.content).toContain('trả lại Sales');
    expect(out.content).toContain('Thiếu ngân sách');
    expect(out.next_action).toContain('bổ sung thông tin');
  });

  it('builds released activity without AM name', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.released, base);
    expect(out.content).toBe('Nguyễn A · Nộp Solution cho Sales');
    expect(out.next_action).toBe('Sales xem Solution và lấy phản hồi khách');
  });
});

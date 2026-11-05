import { describe, expect, it } from 'vitest';
import { leadListSituation } from './lead-list-situation';

describe('leadListSituation', () => {
  it('shows the column name in Vietnamese', () => {
    expect(leadListSituation({ status: 'da_lien_he' }).status).toBe('Đã liên hệ');
    expect(leadListSituation({ status: 'moi' }).status).toBe('Mới');
    expect(leadListSituation({ status: 'dang_tu_van' }).status).toBe('Đang tư vấn');
    expect(leadListSituation({ status: 'nurture' }).status).toBe('Chăm sóc lại');
  });

  it('adds the latest call result beside the column', () => {
    expect(leadListSituation({ status: 'moi', last_call_result: 'unreachable' }).call).toBe('Máy bận');
    expect(leadListSituation({ status: 'nurture', last_call_result: 'callback_requested' }).call).toBe(
      'Hẹn gọi lại',
    );
    expect(leadListSituation({ status: 'da_lien_he', last_call_result: 'connected_qualified' }).call).toBe(
      'Đã nói chuyện',
    );
  });

  it('marks a lead that has been sent to Solution', () => {
    expect(leadListSituation({ status: 'dang_tu_van', solution_handoff: 'with_solution' }).solution).toBe(
      'Đã chuyển Solution',
    );
    expect(leadListSituation({ status: 'dang_tu_van', solution_handoff: 'released' }).solution).toBeNull();
  });
});

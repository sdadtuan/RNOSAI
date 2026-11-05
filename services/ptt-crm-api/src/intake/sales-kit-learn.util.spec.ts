import {
  answerHasForbiddenMoney,
  candidateFromDownTurn,
  candidatesFromCompletedSession,
  normalizeLearnQuestion,
} from './sales-kit-learn.util';

describe('sales-kit-learn.util', () => {
  it('normalizes question', () => {
    expect(normalizeLearnQuestion('  ĐẮT   quá  ')).toBe('đắt quá');
  });

  it('forbids money in qa answers', () => {
    expect(answerHasForbiddenMoney('Gói 20 triệu', 'qa')).toBe(true);
    expect(answerHasForbiddenMoney('Neo gói, hỏi ngân sách', 'qa')).toBe(false);
    expect(answerHasForbiddenMoney('Band 5–10 triệu', 'pricing')).toBe(false);
  });

  it('builds candidate from down turn', () => {
    const row = candidateFromDownTurn({
      turn: {
        id: 't1',
        user_text: 'đắt quá',
        reply_vi: 'Neo gói trung cấp',
        citations_json: [],
      },
      serviceSlug: 'dich-vu-seo-tong-the',
      sessionId: 12,
      leadId: 5,
    });
    expect(row?.folder_key).toBe('dich-vu-seo-tong-the/qa');
    expect(row?.question).toBe('đắt quá');
  });

  it('rejects down turn with invented money', () => {
    expect(
      candidateFromDownTurn({
        turn: {
          id: 't1',
          user_text: 'giá',
          reply_vi: 'Gói 20 triệu',
          citations_json: [],
        },
        serviceSlug: 'dich-vu-seo-tong-the',
        sessionId: 12,
        leadId: null,
      }),
    ).toBeNull();
  });

  it('builds up to 3 candidates from completed session', () => {
    const rows = candidatesFromCompletedSession({
      session: {
        id: 1,
        lead_id: 2,
        service_slug: 'dich-vu-seo-tong-the',
        decision: 'go',
        decision_reason: 'Budget rõ',
      },
      upTurns: [
        {
          id: 'u1',
          user_text: 'case BDS',
          reply_vi: 'Case study nội bộ',
          citations_json: [{ kind: 'case' }],
        },
        {
          id: 'u2',
          user_text: 'giá',
          reply_vi: 'KH hỏi giá',
          citations_json: [],
        },
      ],
    });
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows[0]?.question).toMatch(/Vì sao go/i);
  });
});

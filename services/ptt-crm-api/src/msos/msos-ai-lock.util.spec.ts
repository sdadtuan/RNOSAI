import { ForbiddenException } from '@nestjs/common';
import { assertHumanMsosAction, MSOS_AI_FORBIDDEN } from './msos-ai-lock.util';

describe('msos-ai-lock.util', () => {
  it('exports forbidden action list', () => {
    expect(MSOS_AI_FORBIDDEN).toEqual(
      expect.arrayContaining(['live', 'issue_io', 'finance_request']),
    );
  });

  it('allows human on forbidden actions', () => {
    expect(() => assertHumanMsosAction('live', 'human')).not.toThrow();
  });

  it('blocks ai on forbidden actions', () => {
    try {
      assertHumanMsosAction('live', 'ai');
      fail('expected ai_action_forbidden');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e).toMatchObject({ response: { error: 'ai_action_forbidden' } });
    }
  });

  it('allows ai on non-forbidden actions', () => {
    expect(() => assertHumanMsosAction('draft_preview', 'ai')).not.toThrow();
  });
});

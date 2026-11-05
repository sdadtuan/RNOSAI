import { describe, expect, it } from 'vitest';
import { needsAssumedConfirm } from './PresalesAssumedConfirmBar';

describe('needsAssumedConfirm (P8.4)', () => {
  it('shows Confirm for assumed_draft even when text empty', () => {
    expect(needsAssumedConfirm({ status: 'assumed_draft' })).toBe(true);
    expect(needsAssumedConfirm({ status: 'assumed_draft', text: '' })).toBe(true);
  });

  it('hides Confirm when validated or assumed_confirmed', () => {
    expect(needsAssumedConfirm({ status: 'validated', text: 'ok' })).toBe(false);
    expect(needsAssumedConfirm({ status: 'assumed_confirmed', text: 'ok' })).toBe(false);
  });

  it('shows Confirm for non-empty legacy assumed / ai_draft', () => {
    expect(needsAssumedConfirm({ status: 'assumed', text: 'pain' })).toBe(true);
    expect(needsAssumedConfirm({ ai_draft: true, text: 'pain' })).toBe(true);
  });
});

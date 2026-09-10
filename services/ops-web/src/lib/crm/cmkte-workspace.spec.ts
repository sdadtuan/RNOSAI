import { describe, expect, it } from 'vitest';
import { evaluatePublishGate } from './cmkte-publish-gate';
import { publishGateFlagsFromItem, rejectCommentValid } from './cmkte-workspace';
import type { ContentOsItem } from '@/lib/content-os-api';

function item(partial: Partial<ContentOsItem>): ContentOsItem {
  return {
    id: 21,
    lifecycle_id: 4,
    idea_id: null,
    title: 'Master',
    format: 'social_post',
    channel: 'facebook',
    funnel_goal: '',
    status: 'draft',
    brief_json: {},
    body_json: {},
    selected_variant_idx: null,
    created_by: '',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('publishGateFlagsFromItem', () => {
  it('treats missing flags as blockers', () => {
    const flags = publishGateFlagsFromItem(item({ brief_json: {} }));
    const gate = evaluatePublishGate(flags);
    expect(gate.status).toBe('Blocked');
    expect(gate.blockers.map((row) => row.code)).toEqual(
      expect.arrayContaining(['brief', 'internal_approval', 'rights_invalid', 'a11y_alt', 'client_approval']),
    );
  });
});

describe('rejectCommentValid', () => {
  it('requires at least 10 characters', () => {
    expect(rejectCommentValid('short')).toBe(false);
    expect(rejectCommentValid('1234567890')).toBe(true);
  });
});

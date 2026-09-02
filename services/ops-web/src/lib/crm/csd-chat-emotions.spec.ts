import { describe, expect, it } from 'vitest';
import { summarizeChatReactions } from './csd-chat-emotions';

describe('summarizeChatReactions', () => {
  it('joins unique emotion icons and a single total like the bubble pill', () => {
    expect(
      summarizeChatReactions([
        { emotion: 'haha', count: 1, mine: false },
        { emotion: 'like', count: 1, mine: true },
        { emotion: 'love', count: 1, mine: false },
      ]),
    ).toEqual({
      emojis: ['👍', '❤️', '😆'],
      total: 3,
      mine: true,
      mineEmotion: 'like',
    });
  });

  it('returns empty when there are no reactions', () => {
    expect(summarizeChatReactions([])).toEqual({
      emojis: [],
      total: 0,
      mine: false,
      mineEmotion: null,
    });
  });
});

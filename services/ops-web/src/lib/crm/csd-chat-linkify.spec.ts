import { describe, expect, it } from 'vitest';
import { normalizeCsdChatUrl, splitCsdChatMessageText } from './csd-chat-linkify';

describe('csd-chat-linkify', () => {
  it('splits plain text and https URLs', () => {
    const segments = splitCsdChatMessageText(
      'Link này https://docs.google.com/spreadsheets/d/abc/edit ok',
    );
    expect(segments).toEqual([
      { type: 'text', value: 'Link này ' },
      {
        type: 'url',
        value: 'https://docs.google.com/spreadsheets/d/abc/edit',
        href: 'https://docs.google.com/spreadsheets/d/abc/edit',
      },
      { type: 'text', value: ' ok' },
    ]);
  });

  it('keeps @mention and #ticket refs', () => {
    expect(splitCsdChatMessageText('@12 xem #PTT-2026-000001')).toEqual([
      { type: 'mention', value: '@12' },
      { type: 'text', value: ' xem ' },
      { type: 'ticket', value: '#PTT-2026-000001' },
    ]);
  });

  it('strips trailing punctuation from URLs', () => {
    const segments = splitCsdChatMessageText('Vào https://example.com/path.');
    expect(segments[1]).toMatchObject({
      type: 'url',
      value: 'https://example.com/path',
      href: 'https://example.com/path',
    });
    expect(segments[2]).toEqual({ type: 'text', value: '.' });
  });

  it('normalizes www links', () => {
    expect(normalizeCsdChatUrl('www.example.com/a')).toBe('https://www.example.com/a');
  });

  it('rejects unsafe schemes', () => {
    expect(normalizeCsdChatUrl('javascript:alert(1)')).toBeNull();
  });
});

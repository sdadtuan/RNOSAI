import { buildOpenAiUserContent } from './ai-llm.client';

describe('buildOpenAiUserContent', () => {
  it('keeps text calls as a string and attaches fetched images', () => {
    expect(buildOpenAiUserContent('hello', [])).toBe('hello');
    expect(buildOpenAiUserContent('hello', ['https://cdn.example/a.jpg'])).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'https://cdn.example/a.jpg' } },
    ]);
  });
});

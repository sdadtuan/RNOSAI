import type { ITextGen } from './i-text-gen';
import { providerFetch } from './provider-http';

const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';

export class OpenAITextGen implements ITextGen {
  readonly providerName = 'openai' as const;

  constructor(private readonly apiKey: string) {}

  async complete(input: { system: string; user: string }): Promise<unknown> {
    const res = await providerFetch(
      OPENAI_CHAT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        }),
      },
      'openai_text_failed',
    );
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
  }
}

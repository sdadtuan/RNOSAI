import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Chat SD manifest', () => {
  it('starts on chat and does not replace the lead-care manifest', () => {
    const raw = readFileSync(
      resolve(__dirname, '../../../public/csd-chat-manifest.webmanifest'),
      'utf8',
    );
    const manifest = JSON.parse(raw) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
    };
    expect(manifest.name).toBe('Chat SD');
    expect(manifest.short_name).toBe('Chat SD');
    expect(manifest.start_url).toBe('/crm/csd/chat?shell=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });
});

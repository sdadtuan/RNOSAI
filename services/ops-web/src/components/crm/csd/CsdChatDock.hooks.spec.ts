import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('CsdChatDock hooks', () => {
  it('registers csd-chat:open before the hidden early return', () => {
    const src = readFileSync(join(here, 'CsdChatDock.tsx'), 'utf8');
    const listener = src.indexOf('addEventListener(CSD_CHAT_OPEN_EVENT');
    const earlyReturn = src.indexOf('if (hidden) return null');
    expect(listener).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(listener).toBeLessThan(earlyReturn);
  });
});

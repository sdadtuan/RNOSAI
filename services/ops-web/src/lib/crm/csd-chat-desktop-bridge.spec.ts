import { describe, expect, it } from 'vitest';
import { readRnosDesktop } from './csd-chat-desktop-bridge';

describe('readRnosDesktop', () => {
  it('returns null when the page is a normal browser', () => {
    expect(readRnosDesktop()).toBeNull();
  });
});

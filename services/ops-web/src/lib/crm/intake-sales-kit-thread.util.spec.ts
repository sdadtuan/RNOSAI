import { describe, expect, it } from 'vitest';
import { chipUserLabel, kitBadge } from './intake-sales-kit-thread.util';

describe('intake-sales-kit-thread.util', () => {
  it('badge Rules when mode off', () => {
    expect(kitBadge({ mode: 'off', stubMode: true })).toBe('Rules');
  });

  it('badge LLM vs Stub vs Ollama', () => {
    expect(kitBadge({ mode: 'openai', stubMode: false })).toBe('LLM');
    expect(kitBadge({ mode: 'openai', stubMode: true })).toBe('Stub');
    expect(kitBadge({ mode: 'ollama', stubMode: false })).toBe('Ollama');
  });

  it('chip ask_library without text keeps label', () => {
    expect(chipUserLabel('ask_library')).toBe('Hỏi kho / Q&A');
  });
});

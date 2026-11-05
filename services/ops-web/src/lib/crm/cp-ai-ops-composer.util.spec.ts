import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAGNIFIC_COMPOSER_STEPS,
  MAGNIFIC_HUMAN_ROUTE_COPY,
  magnificComposerEmptyCopy,
} from './cp-ai-ops-composer.util';

describe('magnificComposerEmptyCopy', () => {
  it('uses dash when both transports are off', () => {
    expect(magnificComposerEmptyCopy(true)).toBe('—');
    expect(magnificComposerEmptyCopy(false)).toBe('');
  });
});

describe('Magnific composer steps', () => {
  it('is a 3-step human confirm flow and never AUTO-routes', () => {
    expect(MAGNIFIC_COMPOSER_STEPS.map((step) => step.id)).toEqual([
      'context',
      'prompt',
      'confirm',
    ]);
    expect(MAGNIFIC_COMPOSER_STEPS[0].label).toBe('1. Kết nối');
    expect(MAGNIFIC_COMPOSER_STEPS[1].label).toBe('2. Prompt');
    expect(MAGNIFIC_COMPOSER_STEPS[2].label).toBe('3. Ước tính và xác nhận');
    expect(MAGNIFIC_HUMAN_ROUTE_COPY).toBe('Người chọn API hoặc MCP. Không tự đốt credit.');
    expect(MAGNIFIC_HUMAN_ROUTE_COPY).not.toMatch(/auto|tự động route/i);
  });
});

describe('CpAiOpsMagnificPane composer', () => {
  it('mounts 3 steps and no-auto copy on the existing Magnific pane', () => {
    const pane = readFileSync(new URL('../../components/crm/cp/CpAiOpsMagnificPane.tsx', import.meta.url), 'utf8');
    expect(pane).toContain('MAGNIFIC_COMPOSER_STEPS');
    expect(pane).toContain('MAGNIFIC_HUMAN_ROUTE_COPY');
    expect(pane).toContain('magnificComposerEmptyCopy');
    expect(pane).toContain('cp-ai-ops-step');
    expect(pane).not.toContain('/crm/aco');
    expect(pane).not.toMatch(/System route|AUTO/i);
  });
});

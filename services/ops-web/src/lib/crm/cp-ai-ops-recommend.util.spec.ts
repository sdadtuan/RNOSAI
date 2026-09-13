import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aiOpsHref } from './cp-ai-ops-panes.util';
import {
  CP_RECOMMEND_HUMAN_COPY,
  formatRecommendReasons,
  recommendPaneOf,
} from './cp-ai-ops-recommend.util';

describe('formatRecommendReasons', () => {
  it('maps locked reason codes to Vietnamese and dash when empty', () => {
    expect(formatRecommendReasons(['WEAVE_HUMAN_CANVAS'])).toBe('Weave — canvas người');
    expect(formatRecommendReasons(['RESTRICTED', 'PRIVATE_LORA'])).toBe(
      'Comfy — asset hạn chế · Comfy — LoRA riêng',
    );
    expect(formatRecommendReasons(['URGENT_PREMIUM'])).toBe('Magnific — gấp, chất lượng');
    expect(formatRecommendReasons(['PROVIDER_DOWN'])).toBe('Provider chưa sẵn');
    expect(formatRecommendReasons([])).toBe('—');
  });
});

describe('recommendPaneOf', () => {
  it('deep-links to existing AI Ops panes and never /crm/aco', () => {
    expect(recommendPaneOf('weavy')).toBe('weave');
    expect(recommendPaneOf('magnific_mcp')).toBe('magnific');
    expect(recommendPaneOf('magnific_rest')).toBe('magnific');
    expect(recommendPaneOf('comfyui')).toBe('comfy');
    expect(aiOpsHref('p1', recommendPaneOf('weavy'))).toBe(
      '/crm/creative-os/projects/p1?tab=ai-ops&pane=weave',
    );
    expect(aiOpsHref('p1', recommendPaneOf('magnific_mcp'))).not.toContain('/crm/aco');
  });
});

describe('Wave D copy', () => {
  it('forbids AUTO burn', () => {
    expect(CP_RECOMMEND_HUMAN_COPY).toBe('Người xác nhận. Không tự đốt credit.');
    expect(CP_RECOMMEND_HUMAN_COPY).not.toMatch(/auto|tự động gửi/i);
  });
});

describe('CpAiOpsRecommend mount', () => {
  it('lives on the existing AI Ops workspace and only calls /ai-ops/recommend', () => {
    const workspace = readFileSync(new URL('../../components/crm/cp/CpAiOpsWorkspace.tsx', import.meta.url), 'utf8');
    const pane = readFileSync(new URL('../../components/crm/cp/CpAiOpsRecommend.tsx', import.meta.url), 'utf8');
    expect(workspace).toContain('CpAiOpsRecommend');
    expect(pane).toContain('recommendAiOpsProvider');
    expect(pane).toContain('CP_RECOMMEND_HUMAN_COPY');
    expect(pane).not.toContain('draftMagnificJob');
    expect(pane).not.toContain('submitMagnificJob');
    expect(pane).not.toMatch(/\/jobs\/draft|AUTO/i);
  });
});

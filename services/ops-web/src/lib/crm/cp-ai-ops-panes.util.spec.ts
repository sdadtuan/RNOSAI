import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CP_PROJECT_TABS } from './cp-project-tabs.util';
import {
  aiOpsHref,
  COMFY_LOCKED_COPY,
  comfyGatewayInputValue,
  comfySettingsStatusCopy,
  isComfySubmitEnabled,
  isMagnificComposerDisabled,
  isMagnificJobTerminal,
  isMagnificTransportEnabled,
  MAGNIFIC_JOB_POLL_TIMEOUT_MS,
  MAGNIFIC_JOB_POLL_TIMEOUT_NOTICE,
  magnificPollTimedOut,
  magnificProviderFromTransport,
  parseAiOpsPane,
  shouldShowComfyLockedCopy,
} from './cp-ai-ops-panes.util';

describe('parseAiOpsPane', () => {
  it('defaults unknown or missing pane to weave', () => {
    expect(parseAiOpsPane(null)).toBe('weave');
    expect(parseAiOpsPane('magnific')).toBe('magnific');
    expect(parseAiOpsPane('nope')).toBe('weave');
  });
});

describe('aiOpsHref', () => {
  it('builds the comfy pane href without extra query params', () => {
    expect(aiOpsHref('p1', 'comfy')).toBe(
      '/crm/creative-os/projects/p1?tab=ai-ops&pane=comfy',
    );
  });

  it('opens Magnific on tab=ai-ops&pane=magnific and never adds a magnific project tab or /crm/aco', () => {
    expect(aiOpsHref('proj-1', 'magnific')).toBe(
      '/crm/creative-os/projects/proj-1?tab=ai-ops&pane=magnific',
    );
    expect(aiOpsHref('proj-1', 'magnific', { job: 'job-9' })).toBe(
      '/crm/creative-os/projects/proj-1?tab=ai-ops&pane=magnific&job=job-9',
    );
    expect(CP_PROJECT_TABS.map((tab) => tab.id)).not.toContain('magnific');
    expect(CP_PROJECT_TABS.map((tab) => tab.id)).not.toContain('weave');
    expect(aiOpsHref('proj-1', 'magnific')).not.toContain('/crm/aco');
  });
});

describe('Magnific transport disable rules', () => {
  it('maps radio API to magnific_rest and MCP to magnific_mcp', () => {
    expect(magnificProviderFromTransport('api')).toBe('magnific_rest');
    expect(magnificProviderFromTransport('mcp')).toBe('magnific_mcp');
  });

  it('disables a radio when its flag is off and disables the composer when both are off', () => {
    const bothOn = { magnificRest: true, magnificMcp: true };
    const restOnly = { magnificRest: true, magnificMcp: false };
    const mcpOnly = { magnificRest: false, magnificMcp: true };
    const bothOff = { magnificRest: false, magnificMcp: false };

    expect(isMagnificTransportEnabled(bothOn, 'api')).toBe(true);
    expect(isMagnificTransportEnabled(bothOn, 'mcp')).toBe(true);
    expect(isMagnificComposerDisabled(bothOn)).toBe(false);

    expect(isMagnificTransportEnabled(restOnly, 'api')).toBe(true);
    expect(isMagnificTransportEnabled(restOnly, 'mcp')).toBe(false);
    expect(isMagnificComposerDisabled(restOnly)).toBe(false);

    expect(isMagnificTransportEnabled(mcpOnly, 'api')).toBe(false);
    expect(isMagnificTransportEnabled(mcpOnly, 'mcp')).toBe(true);
    expect(isMagnificComposerDisabled(mcpOnly)).toBe(false);

    expect(isMagnificTransportEnabled(bothOff, 'api')).toBe(false);
    expect(isMagnificTransportEnabled(bothOff, 'mcp')).toBe(false);
    expect(isMagnificComposerDisabled(bothOff)).toBe(true);
  });
});

describe('Comfy GPU health disable rules', () => {
  const now = Date.parse('2026-09-13T03:00:30.000Z');
  const freshOk = {
    ok: true as const,
    vram_mb: 24576,
    checked_at: '2026-09-13T03:00:01.000Z',
  };
  const building = { ok: false as const, reason: 'gpu_building' as const };

  it('keeps the exact locked copy and shows it unless health ok is true', () => {
    expect(COMFY_LOCKED_COPY).toBe('Đang xây GPU — chưa nhận job.');
    expect(shouldShowComfyLockedCopy(undefined)).toBe(true);
    expect(shouldShowComfyLockedCopy(building)).toBe(true);
    expect(shouldShowComfyLockedCopy({ ok: false, reason: 'gpu_building' })).toBe(true);
    expect(shouldShowComfyLockedCopy(freshOk)).toBe(false);
  });

  it('enables Submit only when the comfy flag is on and heartbeat ok is true and fresh', () => {
    expect(isComfySubmitEnabled({ comfy: true }, freshOk, now)).toBe(true);
    expect(isComfySubmitEnabled({ comfy: false }, freshOk, now)).toBe(false);
    expect(isComfySubmitEnabled({ comfy: true }, building, now)).toBe(false);
    expect(isComfySubmitEnabled({ comfy: true }, { ok: false, reason: 'gpu_building' }, now)).toBe(false);
    expect(isComfySubmitEnabled({ comfy: true }, undefined, now)).toBe(false);
    expect(isComfySubmitEnabled({ comfy: true }, {
      ok: true,
      vram_mb: 24576,
      checked_at: '2026-09-13T02:59:59.000Z',
    }, now)).toBe(false);
  });

  it('never echoes a saved gateway URL into Settings or the composer', () => {
    expect(comfyGatewayInputValue('http://127.0.0.1:8188')).toBe('');
    expect(comfyGatewayInputValue({ url: 'http://gpu.internal:8188' })).toBe('');
    expect(comfySettingsStatusCopy(building)).toBe('GPU chưa sẵn sàng');
    expect(comfySettingsStatusCopy(undefined)).toBe('GPU chưa sẵn sàng');
    expect(comfySettingsStatusCopy(freshOk)).toBe('GPU chưa sẵn sàng');
  });

  it('keeps :8188 and gateway env out of the Comfy pane and Settings composer path', () => {
    const pane = readFileSync(new URL('../../components/crm/cp/CpAiOpsComfyPane.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(new URL('../../components/crm/cp/CpAiOpsWorkspace.tsx', import.meta.url), 'utf8');
    const settings = readFileSync(new URL('../../components/crm/cp/CpSettings.tsx', import.meta.url), 'utf8');
    expect(`${pane}\n${workspace}`).not.toMatch(/:8188|COMFYUI_GATEWAY|\/crm\/aco/i);
    expect(pane).not.toContain('comfyGateway');
    expect(settings).toContain('cp-settings-comfy-gateway');
    expect(settings).toContain('comfySettingsStatusCopy');
    expect(settings).toContain('COMFYUI_GATEWAY_URL');
    expect(settings).not.toContain('Lưu URL gateway');
    expect(settings).not.toContain('Đã nhận URL gateway');
    expect(workspace).toContain('CpAiOpsComfyPane');
  });
});

describe('Magnific job poll', () => {
  it('stops on terminal qc|completed|failed|cancelled|expired and times out at 600s', () => {
    expect(['qc', 'completed', 'failed', 'cancelled', 'expired'].every(isMagnificJobTerminal)).toBe(true);
    expect(isMagnificJobTerminal('queued')).toBe(false);
    expect(isMagnificJobTerminal('running')).toBe(false);
    expect(MAGNIFIC_JOB_POLL_TIMEOUT_MS).toBe(600_000);
    expect(magnificPollTimedOut(599_999)).toBe(false);
    expect(magnificPollTimedOut(600_000)).toBe(true);
    expect(MAGNIFIC_JOB_POLL_TIMEOUT_NOTICE).toMatch(/thời gian|chờ/i);
  });
});

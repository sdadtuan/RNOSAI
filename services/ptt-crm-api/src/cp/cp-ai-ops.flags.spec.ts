import { isMagnificFlowsEnabled, readAiOpsFlags } from './cp-ai-ops.flags';

describe('readAiOpsFlags', () => {
  it('treats unset flags as off and hides the AI Ops tab', () => {
    expect(readAiOpsFlags({}).showAiOpsTab).toBe(false);
  });

  it('turns weave on from PTT_WEAVE=1 and shows the tab', () => {
    expect(readAiOpsFlags({ PTT_WEAVE: '1' }).weave).toBe(true);
    expect(readAiOpsFlags({ PTT_WEAVE: '1' }).showAiOpsTab).toBe(true);
  });

  it('turns magnific MCP on from MAGNIFIC_MCP_ENABLED=1', () => {
    expect(readAiOpsFlags({ MAGNIFIC_MCP_ENABLED: '1' }).magnificMcp).toBe(true);
  });

  it('turns magnific REST on from MAGNIFIC_REST_API_ENABLED=true', () => {
    expect(readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: 'true' }).magnificRest).toBe(true);
  });

  it('turns comfy on from COMFYUI_WORKER_ENABLED=1', () => {
    expect(readAiOpsFlags({ COMFYUI_WORKER_ENABLED: '1' }).comfy).toBe(true);
  });

  it('turns magnific flows on from MAGNIFIC_FLOWS_ENABLED=1', () => {
    expect(readAiOpsFlags({ MAGNIFIC_FLOWS_ENABLED: '1' }).magnificFlows).toBe(true);
  });

  it('requires REST for isMagnificFlowsEnabled', () => {
    const restOff = readAiOpsFlags({ MAGNIFIC_FLOWS_ENABLED: '1' });
    expect(isMagnificFlowsEnabled(restOff)).toBe(false);

    const bothOn = readAiOpsFlags({
      MAGNIFIC_FLOWS_ENABLED: 'true',
      MAGNIFIC_REST_API_ENABLED: '1',
    });
    expect(isMagnificFlowsEnabled(bothOn)).toBe(true);
  });
});

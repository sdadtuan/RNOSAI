function isEnabled(value: string | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export type CpAiOpsFlagsSnapshot = {
  weave: boolean;
  magnificMcp: boolean;
  magnificRest: boolean;
  magnificFlows: boolean;
  comfy: boolean;
  showAiOpsTab: boolean;
};

export function readAiOpsFlags(env: NodeJS.ProcessEnv = process.env): CpAiOpsFlagsSnapshot {
  const weave = isEnabled(env.PTT_WEAVE);
  const magnificMcp = isEnabled(env.MAGNIFIC_MCP_ENABLED);
  const magnificRest = isEnabled(env.MAGNIFIC_REST_API_ENABLED);
  const magnificFlows = isEnabled(env.MAGNIFIC_FLOWS_ENABLED);
  const comfy = isEnabled(env.COMFYUI_WORKER_ENABLED);
  return {
    weave,
    magnificMcp,
    magnificRest,
    magnificFlows,
    comfy,
    showAiOpsTab: weave || magnificMcp || magnificRest || comfy,
  };
}

/** Flow API requires both the flows flag and REST API (server-side key). */
export function isMagnificFlowsEnabled(flags: CpAiOpsFlagsSnapshot): boolean {
  return flags.magnificFlows && flags.magnificRest;
}

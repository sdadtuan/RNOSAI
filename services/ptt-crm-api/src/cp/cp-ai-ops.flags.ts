function isEnabled(value: string | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export function readAiOpsFlags(env: NodeJS.ProcessEnv = process.env): {
  weave: boolean;
  magnificMcp: boolean;
  magnificRest: boolean;
  comfy: boolean;
  showAiOpsTab: boolean;
} {
  const weave = isEnabled(env.PTT_WEAVE);
  const magnificMcp = isEnabled(env.MAGNIFIC_MCP_ENABLED);
  const magnificRest = isEnabled(env.MAGNIFIC_REST_API_ENABLED);
  const comfy = isEnabled(env.COMFYUI_WORKER_ENABLED);
  return {
    weave,
    magnificMcp,
    magnificRest,
    comfy,
    showAiOpsTab: weave || magnificMcp || magnificRest || comfy,
  };
}

export function isLeadPipelineTabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB === '1';
}

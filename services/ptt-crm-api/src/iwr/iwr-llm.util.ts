export function iwrLlmEnabled(): boolean {
  return process.env.PTT_IWR_LLM === '1';
}

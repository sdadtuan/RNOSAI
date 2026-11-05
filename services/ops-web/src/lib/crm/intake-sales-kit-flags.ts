export function intakeSalesKitEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_INTAKE_SALES_KIT ?? '1').trim() !== '0';
}

export function intakeSalesKitLlmEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM ?? '0').trim() === '1';
}

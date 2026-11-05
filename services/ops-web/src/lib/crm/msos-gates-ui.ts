export function canEnableLiveButton(gates: { id: string; pass: boolean }[]): boolean {
  return (
    gates.some((g) => g.id === 'GT-P01' && g.pass) &&
    gates.some((g) => g.id === 'GT-P02' && g.pass)
  );
}

export function canEnableInvoiceButton(input: {
  packOfficial: boolean;
  discrepancyBlock: boolean;
}): boolean {
  return input.packOfficial && !input.discrepancyBlock;
}

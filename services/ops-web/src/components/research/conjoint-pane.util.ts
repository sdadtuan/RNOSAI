export const CJ_TAB_BANNER =
  'Conjoint lite — đếm mức được chọn theo thuộc tính. Không market simulator. Không suy MOE.';

export function shouldShowConjointTab(productType: string): boolean {
  return productType === 'PRICE_OFFER';
}

export function formatSharePct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

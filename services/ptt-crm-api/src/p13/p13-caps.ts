import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';

const FINANCE_CODES = new Set(['finance', 'svc-finance', 'ke-toan', 'tai-chinh', 'ketoan', 'accounting']);

const PRICING_EDIT = [
  { section_id: 'p13_pricing', action: 'view' },
  { section_id: 'p13_pricing', action: 'cost.view' },
  { section_id: 'p13_pricing', action: 'edit_draft' },
];

export function p13PositionCaps(
  positionCode: string | null | undefined,
): Array<{ section_id: string; action: string }> {
  const code = String(positionCode ?? '').trim().toLowerCase();
  const ceoOnly = code === 'ceo';
  const ceo = ceoOnly || isSuperAdminPositionCode(positionCode);
  const gdkd = code === 'gdkd' || code === 'gd-kd' || code === 'giam-doc-kinh-doanh' || code === 'sales-director';
  const finance = FINANCE_CODES.has(code);
  if (code === 'ae' || code === 'acm') {
    return [{ section_id: 'p13_catalog', action: 'view' }];
  }
  if (!ceo && !gdkd && !finance) return [];
  if (gdkd && !ceo && !finance) {
    return [{ section_id: 'p13_quote', action: 'margin.view' }];
  }
  const caps = ceo
    ? [
        { section_id: 'p13_catalog', action: 'view' },
        { section_id: 'p13_catalog', action: 'manage' },
        { section_id: 'p13_holidays', action: 'manage' },
        ...PRICING_EDIT,
        { section_id: 'p13_pricing', action: 'activate' },
        { section_id: 'p13_quote', action: 'margin.view' },
      ]
    : [
        ...PRICING_EDIT,
        { section_id: 'p13_quote', action: 'margin.view' },
      ];
  if (ceoOnly) {
    caps.push({ section_id: 'p13_settings', action: 'quote.edit' });
    caps.push({ section_id: 'p13_quote', action: 'approve_discount' });
  }
  return caps;
}

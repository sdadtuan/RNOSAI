/** Catalog role → HR position used to suggest who does the work. */
export const QUOTE_SHEET_ROLE_POSITION: Record<string, string> = {
  am: 'AE',
  strategist: 'GDKD',
  content: 'MKL',
  design: 'MKL',
  ads: 'MKL',
  dev: 'MKL',
  data_crm: 'MKL',
  media_booking: 'MKL',
  video_production: 'MKL',
};

export const QUOTE_SHEET_ROLE_LABEL: Record<string, string> = {
  am: 'Account',
  strategist: 'Chiến lược',
  content: 'Nội dung',
  design: 'Thiết kế',
  ads: 'Quảng cáo',
  dev: 'Kỹ thuật',
  data_crm: 'Data / CRM',
  media_booking: 'Booking media',
  video_production: 'Sản xuất video',
  client: 'Khách hàng',
};

export const QUOTE_SHEET_MAX_SERVICES = 4;

export type QuoteSheetStaff = {
  id: number;
  name: string;
  position_code: string;
  position_name: string;
  monthly_salary_vnd: number;
  hours_per_month: number;
  hourly_vnd: number;
};

export type QuoteSheetService = {
  code: string;
  name: string;
  item_count: number;
};

export type QuoteSheetItem = {
  code: string;
  service_code: string;
  service_name: string;
  phase_code: string;
  phase_name: string;
  task: string;
  subtask: string;
  role_code: string;
  est_hours: number;
  qty: number;
  unit: string;
  billable: boolean;
  client_only: boolean;
};

export type QuoteSheetLineInput = {
  item_code: string;
  staff_id: number | null;
  hours: number;
  included: boolean;
};

export type QuoteSheetRow = {
  item_code: string;
  task: string;
  subtask: string;
  role_code: string;
  role_label: string;
  hours: number;
  qty: number;
  unit: string;
  chargeable: boolean;
  staff_id: number | null;
  staff_name: string;
  position_name: string;
  monthly_salary_vnd: number;
  hours_per_month: number;
  hourly_vnd: number;
  amount_vnd: number;
  included: boolean;
};

export type QuoteSheetGroup = {
  service_code: string;
  service_name: string;
  phase_code: string;
  phase_name: string;
  rows: QuoteSheetRow[];
};

export type QuoteSheetView = {
  editable: boolean;
  services: QuoteSheetService[];
  staff: QuoteSheetStaff[];
  selected_service_codes: string[];
  groups: QuoteSheetGroup[];
  included_count: number;
  missing_staff_count: number;
  total_vnd: number;
  promo_percent: number;
  vat_percent: number;
  promo_vnd: number;
  vat_vnd: number;
  grand_total_vnd: number;
};

export type ImplementationPlanLine = {
  task: string;
  subtask: string;
  role_label: string;
  hours: number;
};

export type ImplementationPlanGroup = {
  service_name: string;
  phase_name: string;
  lines: ImplementationPlanLine[];
};

/** Work left after the contract is signed. Customer-facing rates and names stay off this list. */
export function implementationPlanFromSheet(sheet: QuoteSheetView): ImplementationPlanGroup[] {
  return sheet.groups
    .map((group) => ({
      service_name: group.service_name,
      phase_name: group.phase_name,
      lines: group.rows
        .filter((row) => row.included)
        .map((row) => ({
          task: row.task,
          subtask: row.subtask,
          role_label: row.role_label,
          hours: row.hours,
        })),
    }))
    .filter((group) => group.lines.length > 0);
}

export function hourlyFromPosition(monthlySalaryVnd: number, hoursPerMonth: number): number {
  if (!Number.isFinite(monthlySalaryVnd) || monthlySalaryVnd <= 0) return 0;
  if (!Number.isFinite(hoursPerMonth) || hoursPerMonth <= 0) return 0;
  return Math.round(monthlySalaryVnd / hoursPerMonth);
}

export function quoteLineAmount(hours: number, qty: number, hourlyVnd: number): number {
  if (hourlyVnd <= 0 || hours <= 0 || qty <= 0) return 0;
  return Math.round(hours * qty * hourlyVnd);
}

export function clampQuotePercent(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(Math.round(amount * 100) / 100, 100);
}

/** Khuyến mại comes off the subtotal. VAT is calculated on what remains. */
export function quoteCommercial(subtotalVnd: number, promoPercent: number, vatPercent: number): {
  promo_percent: number;
  vat_percent: number;
  promo_vnd: number;
  vat_vnd: number;
  grand_total_vnd: number;
} {
  const promo = clampQuotePercent(promoPercent);
  const vat = clampQuotePercent(vatPercent);
  const base = Number.isFinite(subtotalVnd) && subtotalVnd > 0 ? Math.round(subtotalVnd) : 0;
  const promoVnd = Math.round((base * promo) / 100);
  const afterPromo = Math.max(0, base - promoVnd);
  const vatVnd = Math.round((afterPromo * vat) / 100);
  return {
    promo_percent: promo,
    vat_percent: vat,
    promo_vnd: promoVnd,
    vat_vnd: vatVnd,
    grand_total_vnd: afterPromo + vatVnd,
  };
}

export function parseQuoteServiceCodes(raw: string | undefined | null): string[] | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return [];
  const codes = [
    ...new Set(
      text
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter((part) => /^[A-Z0-9]{2,8}$/.test(part)),
    ),
  ];
  return codes.slice(0, QUOTE_SHEET_MAX_SERVICES);
}

export function readStoredQuoteSheet(raw: unknown): {
  service_codes: string[];
  lines: QuoteSheetLineInput[];
  vat_percent: number;
  promo_percent: number;
} {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const codes = Array.isArray(record.service_codes)
    ? parseQuoteServiceCodes(record.service_codes.map((code) => String(code)).join(','))
    : parseQuoteServiceCodes(typeof record.service_codes === 'string' ? record.service_codes : '');
  const linesRaw = Array.isArray(record.lines) ? record.lines : [];
  const lines: QuoteSheetLineInput[] = [];
  for (const line of linesRaw) {
    if (!line || typeof line !== 'object') continue;
    const row = line as Record<string, unknown>;
    const itemCode = String(row.item_code ?? '').trim();
    if (!itemCode) continue;
    const staffRaw = row.staff_id;
    const staffId = staffRaw == null || staffRaw === '' ? null : Number(staffRaw);
    const hours = Number(row.hours);
    lines.push({
      item_code: itemCode,
      staff_id: staffId != null && Number.isFinite(staffId) && staffId > 0 ? Math.trunc(staffId) : null,
      hours: Number.isFinite(hours) ? hours : 0,
      included: row.included !== false,
    });
  }
  return {
    service_codes: codes ?? [],
    lines,
    vat_percent: clampQuotePercent(record.vat_percent),
    promo_percent: clampQuotePercent(record.promo_percent),
  };
}

export function defaultStaffId(roleCode: string, staff: QuoteSheetStaff[]): number | null {
  const position = QUOTE_SHEET_ROLE_POSITION[roleCode];
  if (!position) return null;
  const match = staff
    .filter((row) => row.position_code === position)
    .sort((left, right) => left.id - right.id)[0];
  return match?.id ?? null;
}

function clampHours(value: number, fallback: number): number {
  const picked = Number.isFinite(value) ? value : fallback;
  if (!Number.isFinite(picked) || picked < 0) return 0;
  return Math.min(Math.round(picked * 100) / 100, 999);
}

export function assembleQuoteSheet(input: {
  editable: boolean;
  services: QuoteSheetService[];
  staff: QuoteSheetStaff[];
  items: QuoteSheetItem[];
  selectedServiceCodes: string[];
  overrides: QuoteSheetLineInput[];
  vatPercent?: number;
  promoPercent?: number;
}): QuoteSheetView {
  const staffById = new Map(input.staff.map((row) => [row.id, row]));
  const overrideByCode = new Map(input.overrides.map((row) => [row.item_code, row]));
  const groups: QuoteSheetGroup[] = [];
  const groupByKey = new Map<string, QuoteSheetGroup>();
  let includedCount = 0;
  let missingStaff = 0;
  let total = 0;

  for (const item of input.items) {
    const chargeable = item.billable && !item.client_only && item.role_code !== 'client';
    const override = overrideByCode.get(item.code);
    const hours = clampHours(override?.hours ?? item.est_hours, item.est_hours);
    const requestedStaff = override?.staff_id ?? defaultStaffId(item.role_code, input.staff);
    const person = requestedStaff != null ? staffById.get(requestedStaff) ?? null : null;
    const included = chargeable ? (override ? override.included : true) : false;
    const amount = included ? quoteLineAmount(hours, item.qty, person?.hourly_vnd ?? 0) : 0;
    if (included) {
      includedCount += 1;
      total += amount;
      if (!person || person.hourly_vnd <= 0) missingStaff += 1;
    }
    const row: QuoteSheetRow = {
      item_code: item.code,
      task: item.task,
      subtask: item.subtask,
      role_code: item.role_code,
      role_label: QUOTE_SHEET_ROLE_LABEL[item.role_code] ?? item.role_code,
      hours,
      qty: item.qty,
      unit: item.unit,
      chargeable,
      staff_id: person?.id ?? null,
      staff_name: person?.name ?? '',
      position_name: person?.position_name ?? '',
      monthly_salary_vnd: person?.monthly_salary_vnd ?? 0,
      hours_per_month: person?.hours_per_month ?? 0,
      hourly_vnd: person?.hourly_vnd ?? 0,
      amount_vnd: amount,
      included,
    };
    const key = `${item.service_code}:${item.phase_code}`;
    let group = groupByKey.get(key);
    if (!group) {
      group = {
        service_code: item.service_code,
        service_name: item.service_name,
        phase_code: item.phase_code,
        phase_name: item.phase_name,
        rows: [],
      };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }

  const commercial = quoteCommercial(total, input.promoPercent ?? 0, input.vatPercent ?? 0);
  return {
    editable: input.editable,
    services: input.services,
    staff: input.staff,
    selected_service_codes: input.selectedServiceCodes,
    groups,
    included_count: includedCount,
    missing_staff_count: missingStaff,
    total_vnd: total,
    ...commercial,
  };
}

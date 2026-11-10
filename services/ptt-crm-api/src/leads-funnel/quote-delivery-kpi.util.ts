import type { QuoteSheetView } from './quote-sheet.util';

export const QUOTE_DELIVERY_HOURS_CODE = 'QUOTE_DELIVERY_HOURS';
export const QUOTE_DELIVERY_HOURS_NAME = 'Giờ triển khai báo giá';

export type DeliveryKpiPerson = {
  staff_id: number;
  staff_name: string;
  position_name: string;
  hours: number;
  tasks: string[];
};

export type DeliveryKpiSplit = {
  people: DeliveryKpiPerson[];
  unassigned_tasks: string[];
};

export function deliveryPeriod(at: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(at);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

/** Labor on one included line: hours worked times the quantity on the quote. */
export function deliveryHours(hours: number, qty: number): number {
  const labor = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const count = Number.isFinite(qty) && qty > 0 ? qty : 0;
  return Math.round(labor * count * 100) / 100;
}

/** Staff assigned on the approved quote, without rates or salaries. */
export function deliveryKpiFromSheet(sheet: QuoteSheetView): DeliveryKpiSplit {
  const byStaff = new Map<number, DeliveryKpiPerson>();
  const unassigned: string[] = [];

  for (const group of sheet.groups) {
    for (const row of group.rows) {
      if (!row.included) continue;
      const task = row.task.trim() || '—';
      if (row.staff_id == null) {
        unassigned.push(task);
        continue;
      }
      const hours = deliveryHours(row.hours, row.qty);
      const current = byStaff.get(row.staff_id);
      if (!current) {
        byStaff.set(row.staff_id, {
          staff_id: row.staff_id,
          staff_name: row.staff_name.trim() || `Nhân sự #${row.staff_id}`,
          position_name: row.position_name.trim(),
          hours,
          tasks: [task],
        });
        continue;
      }
      current.hours = Math.round((current.hours + hours) * 100) / 100;
      current.tasks.push(task);
    }
  }

  return {
    people: [...byStaff.values()].sort((left, right) => left.staff_name.localeCompare(right.staff_name, 'vi')),
    unassigned_tasks: unassigned,
  };
}

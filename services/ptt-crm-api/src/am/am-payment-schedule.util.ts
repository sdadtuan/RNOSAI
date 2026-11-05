import { monthlyRecurringVnd } from './am-money.util';

const ONE_OFF = new Set(['media', 'media_spend', 'project', 'one_off']);
const ROW_CAP = 36;

export type AmPaymentRow = {
  due_on: string;
  amount_vnd: number | null;
  status: 'upcoming' | 'overdue';
  source: 'derived';
};

export function derivePaymentSchedule(input: {
  billing_type: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  signed_on: string | null;
  as_of: string;
}): AmPaymentRow[] {
  return derivePaymentScheduleResult(input).rows;
}

export function derivePaymentScheduleResult(input: {
  billing_type: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  signed_on: string | null;
  as_of: string;
}): { rows: AmPaymentRow[]; truncated: boolean } {
  const start = input.starts_on ?? input.signed_on;
  if (!start) return { rows: [], truncated: false };

  const billing = input.billing_type.trim().toLowerCase();
  if (ONE_OFF.has(billing)) {
    return { rows: [toRow(start, input.amount_vnd, input.as_of)], truncated: false };
  }

  const amount =
    input.amount_vnd == null
      ? null
      : monthlyRecurringVnd({
          billingType: billing,
          amountVnd: input.amount_vnd,
          startsOn: input.starts_on,
          endsOn: input.ends_on,
        });

  if (!input.ends_on) {
    return { rows: [toRow(start, amount, input.as_of)], truncated: false };
  }

  const rows: AmPaymentRow[] = [];
  let i = 0;
  let due = start;
  while (due <= input.ends_on) {
    if (rows.length === ROW_CAP) return { rows, truncated: true };
    rows.push(toRow(due, amount, input.as_of));
    i += 1;
    due = addCalendarMonths(start, i);
  }
  return { rows, truncated: false };
}

function toRow(dueOn: string, amount: number | null, asOf: string): AmPaymentRow {
  return {
    due_on: dueOn,
    amount_vnd: amount,
    status: dueOn < asOf ? 'overdue' : 'upcoming',
    source: 'derived',
  };
}

function addCalendarMonths(ymd: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

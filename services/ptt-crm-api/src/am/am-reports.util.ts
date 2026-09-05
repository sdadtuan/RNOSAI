import { isStale } from './am-freshness.util';
import { isActiveBook } from './am-health.util';
import { monthlyRecurringVnd } from './am-money.util';
import type { AmAmStatus, AmScope } from './am.types';

export const AM_REPORT_FORMULAS = {
  logo: 'Logo = remaining_end / start_set          (new logos excluded from denominator)',
  grr: 'GRR  = (Start − Churn − Contraction) / Start',
  nrr: 'NRR  = (Start − Churn − Contraction + Expansion) / Start',
} as const;

export const AM_REPORT_NRR_HIDDEN_NOTE =
  'Thiếu phân loại expansion — NRR được ẩn. Logo Retention vẫn hiển thị.';

export const AM_REPORT_EXPORT_TOOLTIP = 'Export >10k sẽ làm bất đồng bộ — chưa mở';

const EXPAND_KINDS = new Set(['upsell', 'cross_sell', 'cross-sell', 'expand', 'expansion']);

export type AmReportsContract = {
  billing_type: string;
  amount_vnd: number;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

export type AmReportsClient = {
  agency_client_id: string;
  owner_staff_id: number | null;
  am_status: string;
  churned_at: string | null;
  churn_reason: string | null;
  contracts: AmReportsContract[];
};

export type AmReportsWonOpp = {
  agency_client_id: string;
  kind: string | null;
  value_vnd: number | null;
};

export type AmReportsLostRenewal = {
  agency_client_id: string;
  lost_on: string | null;
  lost_reason: string | null;
};

export type AmReportsForecastInput = {
  bucket: 'committed' | 'likely' | 'risk' | 'unlikely';
  value_vnd: number | null;
};

export type AmReportsRetention = {
  period: { from: string; to: string };
  freshness: { as_of: string; stale: boolean };
  kpis: {
    logo: number | null;
    grr: number | null;
    nrr: number | null;
    churned_mrr: number | null;
    expansion_mrr: number | null;
  };
  nrr_hidden: boolean;
  note: string | null;
  formulas: { logo: string; grr: string; nrr: string };
  drills: {
    logo: string;
    grr: string;
    nrr: string | null;
    churned_mrr: string;
    expansion_mrr: string | null;
  };
  cohort: Array<{ cohort: string; cells: Array<{ period: string; rate: number | null }> }>;
  forecast: Array<{ bucket: 'committed' | 'likely' | 'risk' | 'unlikely'; value_vnd: number | null }>;
  churn_reasons: Array<{ reason: string; count: number; mrr: number | null }>;
  by_owner: Array<{ owner_staff_id: number | null; logo: number | null; grr: number | null }>;
};

export function amGrrNrr({
  start,
  churn,
  contraction,
  expansion,
}: {
  start: number;
  churn: number;
  contraction: number;
  expansion: number | null;
}): { grr: number | null; nrr: number | null } {
  if (start === 0) return { grr: null, nrr: null };
  const grr = (start - churn - contraction) / start;
  if (expansion == null) return { grr, nrr: null };
  return { grr, nrr: (start - churn - contraction + expansion) / start };
}

export function amLogoRetention({
  startSet,
  remainingEnd,
}: {
  startSet: number;
  remainingEnd: number;
}): number | null {
  if (startSet === 0) return null;
  return remainingEnd / startSet;
}

export function amIsExpandKind(kind: string | null | undefined): boolean {
  return EXPAND_KINDS.has(String(kind ?? '').trim().toLowerCase());
}

export function amContractActiveOn(
  startsOn: string | null,
  endsOn: string | null,
  on: string,
): boolean {
  if (!startsOn || startsOn > on) return false;
  return endsOn == null || endsOn === '' || endsOn >= on;
}

export function amRecurringMrrAt(contracts: AmReportsContract[], on: string): number | null {
  let sum = 0;
  let any = false;
  for (const ct of contracts) {
    if (!amContractActiveOn(dayStr(ct.starts_on), dayStr(ct.ends_on), on)) continue;
    const mrr = monthlyRecurringVnd({
      billingType: String(ct.billing_type ?? '').trim().toLowerCase(),
      amountVnd: Number(ct.amount_vnd ?? 0),
      startsOn: dayStr(ct.starts_on),
      endsOn: dayStr(ct.ends_on),
    });
    if (mrr == null) continue;
    sum += mrr;
    any = true;
  }
  return any ? sum : null;
}

export function amFirstRecurringStartsOn(contracts: AmReportsContract[]): string | null {
  let first: string | null = null;
  for (const ct of contracts) {
    const start = dayStr(ct.starts_on);
    if (!start) continue;
    const mrr = monthlyRecurringVnd({
      billingType: String(ct.billing_type ?? '').trim().toLowerCase(),
      amountVnd: Number(ct.amount_vnd ?? 0),
      startsOn: start,
      endsOn: dayStr(ct.ends_on),
    });
    if (mrr == null) continue;
    if (!first || start < first) first = start;
  }
  return first;
}

export function amIsNewLogo(
  firstRecurringStartsOn: string | null,
  from: string,
  to: string,
): boolean {
  if (!firstRecurringStartsOn) return false;
  return firstRecurringStartsOn > from && firstRecurringStartsOn <= to;
}

export function amIsStartSetLogo(
  client: AmReportsClient,
  period: { from: string; to: string },
): boolean {
  if (amIsNewLogo(amFirstRecurringStartsOn(client.contracts), period.from, period.to)) return false;
  if (churnedOnOrBefore(client.churned_at, period.from)) return false;
  return client.contracts.some((ct) => {
    if (!amContractActiveOn(dayStr(ct.starts_on), dayStr(ct.ends_on), period.from)) return false;
    return (
      monthlyRecurringVnd({
        billingType: String(ct.billing_type ?? '').trim().toLowerCase(),
        amountVnd: Number(ct.amount_vnd ?? 0),
        startsOn: dayStr(ct.starts_on),
        endsOn: dayStr(ct.ends_on),
      }) != null
    );
  });
}

export function amLogoStartSet(
  clients: AmReportsClient[],
  period: { from: string; to: string },
): AmReportsClient[] {
  return clients.filter((row) => amIsStartSetLogo(row, period));
}

export function amReportsDrillHref(opts: {
  report: string;
  from: string;
  to: string;
  scope: string;
}): string {
  const params = new URLSearchParams();
  params.set('from', opts.from);
  params.set('to', opts.to);
  params.set('scope', opts.scope);
  params.set('report', opts.report);
  return `/crm/account-management/clients?${params.toString()}`;
}

export function amBuildRetention(input: {
  period: { from: string; to: string };
  scope: AmScope;
  clients: AmReportsClient[];
  wonExpandOpps: AmReportsWonOpp[];
  lostRenewals: AmReportsLostRenewal[];
  forecast: AmReportsForecastInput[];
  freshnessAsOf: string | null;
  now: Date;
}): AmReportsRetention {
  const { period, scope } = input;
  const lostByClient = new Map<string, AmReportsLostRenewal>();
  for (const row of input.lostRenewals) {
    lostByClient.set(row.agency_client_id, row);
  }

  const startSet = amLogoStartSet(input.clients, period);
  const remaining = startSet.filter((row) =>
    isRemainingEnd(row, period.to, lostByClient.get(row.agency_client_id) ?? null),
  );

  let startMoney = 0;
  let hadStartMoney = false;
  let churnMoney = 0;
  let hadChurnMoney = false;
  let contraction = 0;
  let hadContraction = false;
  let survivorExpansion = 0;
  let hadSurvivorExpansion = false;
  const expandedClients = new Set<string>();
  const churned: AmReportsClient[] = [];

  for (const row of startSet) {
    const startMrr = amRecurringMrrAt(row.contracts, period.from);
    if (startMrr != null) {
      startMoney += startMrr;
      hadStartMoney = true;
    }
    const lost = lostByClient.get(row.agency_client_id) ?? null;
    if (isChurnedInPeriod(row, period, lost)) {
      churned.push(row);
      if (startMrr != null) {
        churnMoney += startMrr;
        hadChurnMoney = true;
      }
      continue;
    }
    const endMrr = amRecurringMrrAt(row.contracts, period.to);
    if (startMrr != null && endMrr != null && endMrr < startMrr) {
      contraction += startMrr - endMrr;
      hadContraction = true;
    }
    if (startMrr != null && endMrr != null && endMrr > startMrr) {
      survivorExpansion += endMrr - startMrr;
      hadSurvivorExpansion = true;
      expandedClients.add(row.agency_client_id);
    }
  }

  const oppByClient = new Map<string, number>();
  for (const opp of input.wonExpandOpps) {
    if (!amIsExpandKind(opp.kind) || opp.value_vnd == null) continue;
    if (expandedClients.has(opp.agency_client_id)) continue;
    oppByClient.set(opp.agency_client_id, (oppByClient.get(opp.agency_client_id) ?? 0) + opp.value_vnd);
  }
  let oppExpansion = 0;
  const hadOppExpansion = oppByClient.size > 0;
  for (const value of oppByClient.values()) oppExpansion += value;

  const classified = hadSurvivorExpansion || hadOppExpansion;
  const expansion = classified ? survivorExpansion + oppExpansion : null;
  const rates = amGrrNrr({
    start: hadStartMoney ? startMoney : 0,
    churn: hadChurnMoney ? churnMoney : 0,
    contraction: hadContraction ? contraction : 0,
    expansion,
  });
  const logo = amLogoRetention({ startSet: startSet.length, remainingEnd: remaining.length });
  const nrrHidden = expansion == null;
  const asOf = input.freshnessAsOf ?? input.now.toISOString();

  return {
    period,
    freshness: { as_of: asOf, stale: isStale(asOf, input.now) },
    kpis: {
      logo,
      grr: rates.grr,
      nrr: rates.nrr,
      churned_mrr: hadChurnMoney ? churnMoney : null,
      expansion_mrr: expansion,
    },
    nrr_hidden: nrrHidden,
    note: nrrHidden ? AM_REPORT_NRR_HIDDEN_NOTE : null,
    formulas: { ...AM_REPORT_FORMULAS },
    drills: {
      logo: amReportsDrillHref({ report: 'logo', from: period.from, to: period.to, scope }),
      grr: amReportsDrillHref({ report: 'grr', from: period.from, to: period.to, scope }),
      nrr: nrrHidden
        ? null
        : amReportsDrillHref({ report: 'nrr', from: period.from, to: period.to, scope }),
      churned_mrr: amReportsDrillHref({
        report: 'churned_mrr',
        from: period.from,
        to: period.to,
        scope,
      }),
      expansion_mrr: nrrHidden
        ? null
        : amReportsDrillHref({ report: 'expansion_mrr', from: period.from, to: period.to, scope }),
    },
    cohort: buildCohort(startSet, period, lostByClient),
    forecast: input.forecast,
    churn_reasons: buildChurnReasons(churned, period.from, lostByClient),
    by_owner: buildByOwner(startSet, remaining, period, lostByClient),
  };
}

function isChurnedInPeriod(
  row: AmReportsClient,
  period: { from: string; to: string },
  lost: AmReportsLostRenewal | null,
): boolean {
  const churnedOn = dayStr(row.churned_at);
  if (churnedOn && churnedOn > period.from && churnedOn <= period.to) return true;
  const lostOn = dayStr(lost?.lost_on);
  return Boolean(lostOn && lostOn > period.from && lostOn <= period.to);
}

function isRemainingEnd(
  row: AmReportsClient,
  to: string,
  lost: AmReportsLostRenewal | null,
): boolean {
  if (churnedOnOrBefore(row.churned_at, to)) return false;
  if (churnedOnOrBefore(lost?.lost_on ?? null, to)) return false;
  const hasRecurring = amRecurringMrrAt(row.contracts, to) != null;
  return hasRecurring || isActiveBook(row.am_status as AmAmStatus);
}

function churnedOnOrBefore(value: string | null, on: string): boolean {
  const day = dayStr(value);
  return Boolean(day && day <= on);
}

function buildCohort(
  startSet: AmReportsClient[],
  period: { from: string; to: string },
  lostByClient: Map<string, AmReportsLostRenewal>,
): AmReportsRetention['cohort'] {
  if (!startSet.length) return [];
  const months = monthsInPeriod(period.from, period.to);
  const groups = new Map<string, AmReportsClient[]>();
  for (const row of startSet) {
    const first = amFirstRecurringStartsOn(row.contracts);
    const key = first ? first.slice(0, 7) : 'unknown';
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, rows]) => ({
      cohort,
      cells: months.map((ym) => {
        const asOf = minDay(monthEnd(ym), period.to);
        const remaining = rows.filter((row) =>
          isRemainingEnd(row, asOf, lostByClient.get(row.agency_client_id) ?? null),
        ).length;
        return { period: ym, rate: amLogoRetention({ startSet: rows.length, remainingEnd: remaining }) };
      }),
    }));
}

function buildChurnReasons(
  churned: AmReportsClient[],
  from: string,
  lostByClient: Map<string, AmReportsLostRenewal>,
): AmReportsRetention['churn_reasons'] {
  const map = new Map<string, { count: number; mrr: number; had: boolean }>();
  for (const row of churned) {
    const lost = lostByClient.get(row.agency_client_id);
    const reason = String(row.churn_reason ?? lost?.lost_reason ?? '').trim() || 'Không rõ';
    const cur = map.get(reason) ?? { count: 0, mrr: 0, had: false };
    cur.count += 1;
    const mrr = amRecurringMrrAt(row.contracts, from);
    if (mrr != null) {
      cur.mrr += mrr;
      cur.had = true;
    }
    map.set(reason, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([reason, row]) => ({ reason, count: row.count, mrr: row.had ? row.mrr : null }));
}

function buildByOwner(
  startSet: AmReportsClient[],
  remaining: AmReportsClient[],
  period: { from: string; to: string },
  lostByClient: Map<string, AmReportsLostRenewal>,
): AmReportsRetention['by_owner'] {
  const owners = [...new Set(startSet.map((row) => row.owner_staff_id))];
  return owners
    .sort((a, b) => (a ?? 0) - (b ?? 0))
    .map((owner) => {
      const mine = startSet.filter((row) => row.owner_staff_id === owner);
      const remain = remaining.filter((row) => row.owner_staff_id === owner);
      let start = 0;
      let churn = 0;
      let contraction = 0;
      let hadStart = false;
      for (const row of mine) {
        const startMrr = amRecurringMrrAt(row.contracts, period.from);
        if (startMrr != null) {
          start += startMrr;
          hadStart = true;
        }
        const lost = lostByClient.get(row.agency_client_id) ?? null;
        if (isChurnedInPeriod(row, period, lost)) {
          if (startMrr != null) churn += startMrr;
          continue;
        }
        const endMrr = amRecurringMrrAt(row.contracts, period.to);
        if (startMrr != null && endMrr != null && endMrr < startMrr) contraction += startMrr - endMrr;
      }
      return {
        owner_staff_id: owner,
        logo: amLogoRetention({ startSet: mine.length, remainingEnd: remain.length }),
        grr: amGrrNrr({
          start: hadStart ? start : 0,
          churn,
          contraction,
          expansion: null,
        }).grr,
      };
    });
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function monthsInPeriod(from: string, to: string): string[] {
  const out: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function monthEnd(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function minDay(a: string, b: string): string {
  return a <= b ? a : b;
}

'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLeadQuoteSheet,
  saveLeadQuoteSheet,
  sendLeadQuoteToSales,
  type LeadFunnelSnapshot,
  type LeadQuoteSheet,
  type LeadQuoteSheetRow,
  type LeadQuoteSheetStaff,
} from '@/lib/api';
import { ActionErrorToast } from '@/components/ui/ActionToast';
import { LeadStepHero } from '@/components/crm/LeadStepHero';
import { readIntakeP13Scope } from '@/lib/crm/intake-p13-scope';
import { suggestQuotePrefillFromDiscovery } from '@/lib/crm/quote-discovery-prefill';
import { quoteRoleLabel } from '@/lib/crm/quote-unit-label';
import './lead-quote-sheet-brand.css';
import { notifyLeadDealFilesChanged } from './LeadDealFilesCard';
import { readDiscoveryBriefFromAnswers } from '@/lib/crm/sales-discovery';

function QuoteGlyph({
  name,
  size = 16,
}: {
  name: 'layers' | 'rocket' | 'chart';
  size?: number;
}) {
  const common = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (name === 'layers') {
    return (
      <svg {...common}>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function groupGlyph(serviceCode: string): 'rocket' | 'chart' {
  const code = serviceCode.trim().toLowerCase();
  if (/(ads|media|seo|tiktok|facebook|google|perf|analytic|traffic|report)/.test(code)) return 'chart';
  return 'rocket';
}


function vnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function percentOf(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value * 100) / 100, 100);
}

function linesFromSheet(sheet: LeadQuoteSheet) {
  return sheet.groups.flatMap((group) =>
    group.rows.map((row) => ({
      item_code: row.item_code,
      staff_id: row.staff_id,
      hours: row.hours,
      qty: row.qty,
      included: row.included,
    })),
  );
}

/** Catalog role → HR position used to suggest a default hourly rate when no staff is assigned. */
const QUOTE_ROLE_POSITION: Record<string, string> = {
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

function defaultHourlyForRole(roleCode: string, staff: LeadQuoteSheetStaff[]): number {
  const position = QUOTE_ROLE_POSITION[roleCode];
  if (!position) return 0;
  const person = staff
    .filter((row) => row.position_code === position && row.hourly_vnd > 0)
    .sort((left, right) => left.id - right.id)[0];
  return person?.hourly_vnd ?? 0;
}

function amountOf(
  row: Pick<LeadQuoteSheetRow, 'chargeable' | 'hours' | 'qty' | 'hourly_vnd' | 'role_code'>,
  staff: LeadQuoteSheetStaff[] = [],
): number {
  if (!row.chargeable) return 0;
  const hourly = row.hourly_vnd > 0 ? row.hourly_vnd : defaultHourlyForRole(row.role_code, staff);
  return Math.round((row.hours || 0) * (row.qty || 0) * (hourly || 0));
}

function withComputedAmounts(sheet: LeadQuoteSheet): LeadQuoteSheet {
  return {
    ...sheet,
    groups: sheet.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({ ...row, amount_vnd: amountOf(row, sheet.staff) })),
    })),
  };
}


function groupKey(group: { service_code: string; phase_code: string }): string {
  return `${group.service_code}:${group.phase_code}`;
}

function tickedServiceCodes(sheet: LeadQuoteSheet): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const group of sheet.groups) {
    if (!group.rows.some((row) => row.included)) continue;
    if (seen.has(group.service_code)) continue;
    seen.add(group.service_code);
    codes.push(group.service_code);
  }
  return codes;
}

function sortSheetGroups(sheet: LeadQuoteSheet): LeadQuoteSheet {
  const order = new Map(sheet.services.map((service, index) => [service.code, index]));
  const groups = [...sheet.groups].sort((left, right) => {
    const delta = (order.get(left.service_code) ?? 999) - (order.get(right.service_code) ?? 999);
    if (delta !== 0) return delta;
    return String(left.phase_code).localeCompare(String(right.phase_code));
  });
  return { ...sheet, groups };
}

/** Incoming catalog groups start unticked so the API default (all chargeable rows included) does not select them. */
function mergeCatalogGroups(base: LeadQuoteSheet, incoming: LeadQuoteSheet): LeadQuoteSheet {
  const have = new Set(base.groups.map(groupKey));
  const added = incoming.groups
    .filter((group) => !have.has(groupKey(group)))
    .map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        const next = { ...row, included: false };
        return { ...next, amount_vnd: amountOf(next, base.staff) };
      }),
    }));
  return sortSheetGroups({ ...base, groups: [...base.groups, ...added] });
}

function quoteHasExistingItems(sheet: LeadQuoteSheet): boolean {
  return sheet.groups.some((group) => group.rows.some((row) => row.included));
}

/** True when every chargeable row is included — the API default for a preselected service, not a user tick. */
function looksLikeCatalogDefault(sheet: LeadQuoteSheet): boolean {
  const rows = sheet.groups.flatMap((group) => group.rows).filter((row) => row.chargeable);
  return rows.length > 0 && rows.every((row) => row.included);
}

function applyLoadedSheet(
  sheet: LeadQuoteSheet,
  previous: LeadQuoteSheet | null,
  includeItemCodes: Set<string> | null,
): LeadQuoteSheet {
  const edits = new Map((previous ? linesFromSheet(previous) : []).map((line) => [line.item_code, line]));
  return {
    ...sheet,
    vat_percent: previous?.vat_percent ?? sheet.vat_percent,
    promo_percent: previous?.promo_percent ?? sheet.promo_percent,
    selected_service_codes: sheet.selected_service_codes?.length
      ? sheet.selected_service_codes
      : previous?.selected_service_codes ?? sheet.selected_service_codes,
    groups: sheet.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        const edit = edits.get(row.item_code);
        if (edit) {
          const person = sheet.staff.find((item) => item.id === edit.staff_id);
          const hourly = person?.hourly_vnd ?? row.hourly_vnd;
          const next = {
            ...row,
            staff_id: person?.id ?? null,
            staff_name: person?.name ?? '',
            position_name: person?.position_name ?? '',
            monthly_salary_vnd: person?.monthly_salary_vnd ?? 0,
            hours_per_month: person?.hours_per_month ?? 0,
            hourly_vnd: hourly,
            hours: edit.hours,
            qty: edit.qty ?? row.qty,
            included: row.chargeable ? edit.included : false,
          };
          return { ...next, amount_vnd: amountOf(next, sheet.staff) };
        }
        const included = Boolean(row.chargeable && includeItemCodes?.has(row.item_code));
        const next = { ...row, included };
        return { ...next, amount_vnd: amountOf(next, sheet.staff) };
      }),
    })),
  };
}

export function LeadQuoteSheet({
  token,
  leadId,
  phase,
  viewerIsSales = false,
  viewerIsCeo = false,
  quoteSentToCeo = false,
  onFunnelChange,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  phase: string;
  viewerIsSales?: boolean;
  viewerIsCeo?: boolean;
  quoteSentToCeo?: boolean;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  onLeadReload?: () => Promise<void> | void;
}) {
  const ceoApproved = phase === 'hop_dong' || phase === 'trien_khai';
  const visible =
    (!viewerIsSales &&
      (phase === 'chuyen_bao_gia' ||
        phase === 'bao_gia' ||
        phase === 'ceo_review' ||
        phase === 'sale_review')) ||
    ceoApproved;
  const [sheet, setSheet] = useState<LeadQuoteSheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const selectedRef = useRef<string[] | null>(null);
  const prefilledRef = useRef(false);
  const sectionLockRef = useRef<{ primary: Set<string>; extra: Set<string> } | null>(null);
  const [openCodes, setOpenCodes] = useState<string[]>([]);
  const [loadingCode, setLoadingCode] = useState('');
  const [openServiceKeys, setOpenServiceKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    sectionLockRef.current = null;
    setLocalError('');

    async function boot() {
      try {
        const [next, sessions, options] = await Promise.all([
          fetchLeadQuoteSheet(token, leadId),
          fetchIntakeSessions(token, { lead_id: leadId }).catch(() => []),
          fetchDiscoveryOptions(token).catch(() => null),
        ]);
        if (cancelled) return;

        const picked = selectedRef.current;
        if (picked && picked.length > 0) {
          setSheet((current) => {
            if (!current) return withComputedAmounts(next);
            return withComputedAmounts({
              ...next,
              selected_service_codes: current.selected_service_codes,
              vat_percent: current.vat_percent,
              promo_percent: current.promo_percent,
              groups: current.groups.length > 0 ? current.groups : next.groups,
            });
          });
          return;
        }

        const incoming = looksLikeCatalogDefault(next) ? applyLoadedSheet(next, null, new Set()) : next;

        const sessionsList = Array.isArray(sessions) ? sessions : [];
        const latest = [...sessionsList].sort((left, right) =>
          String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')),
        );
        let discoveryServices: string[] = [];
        let p13Scope = null as ReturnType<typeof readIntakeP13Scope>;
        for (const session of latest) {
          const brief = readDiscoveryBriefFromAnswers(session.answers_json);
          const scope = readIntakeP13Scope(session.answers_json);
          if ((brief?.services?.length ?? 0) > 0 || scope?.service_code) {
            discoveryServices = brief?.services ?? [];
            p13Scope = scope;
            break;
          }
        }

        const canPrefill = !prefilledRef.current && !quoteHasExistingItems(incoming) && (discoveryServices.length > 0 || Boolean(p13Scope?.service_code));
        if (canPrefill) {
          const firstPass = suggestQuotePrefillFromDiscovery({
            discoveryServices,
            serviceGroups: options?.service_groups,
            quoteServices: incoming.services,
            quoteItems: [],
            p13Scope,
          });
          if (firstPass.serviceCodes.length > 0) {
            prefilledRef.current = true;
            const codes = firstPass.serviceCodes;
            const loaded = await fetchLeadQuoteSheet(token, leadId, codes);
            if (cancelled) return;
            const mapped = suggestQuotePrefillFromDiscovery({
              discoveryServices,
              serviceGroups: options?.service_groups,
              quoteServices: loaded.services,
              quoteItems: loaded.groups.flatMap((group) =>
                group.rows.map((row) => ({
                  item_code: row.item_code,
                  service_code: group.service_code,
                  task: row.task,
                  subtask: row.subtask,
                })),
              ),
              p13Scope,
            });
            const applied = applyLoadedSheet(
              {
                ...loaded,
                selected_service_codes: loaded.selected_service_codes?.length
                  ? loaded.selected_service_codes
                  : codes,
              },
              null,
              new Set(mapped.itemCodes),
            );
            selectedRef.current = applied.selected_service_codes;
            if (cancelled) return;
            setSheet(withComputedAmounts(applied));
            return;
          }
        }

        if (cancelled) return;
        setSheet(withComputedAmounts(incoming));
      } catch (err: unknown) {
        if (!cancelled) setLocalError(err instanceof Error ? err.message : 'Không tải được bảng báo giá');
      }
    }

    void boot();
    function onDiscoveryChanged() {
      if (prefilledRef.current) return;
      void boot();
    }
    window.addEventListener('sld:discovery-changed', onDiscoveryChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('sld:discovery-changed', onDiscoveryChanged);
    };
  }, [visible, token, leadId, phase, viewerIsSales]);

  if (!visible) return null;

  function patchRow(itemCode: string, patch: Partial<LeadQuoteSheetRow>) {
    if (!sheet) return;
    const nextGroups = sheet.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        if (row.item_code !== itemCode) return row;
        const next = { ...row, ...patch };
        return { ...next, amount_vnd: amountOf(next, sheet.staff) };
      }),
    }));
    const nextSheet: LeadQuoteSheet = {
      ...sheet,
      groups: nextGroups,
      selected_service_codes: tickedServiceCodes({ ...sheet, groups: nextGroups }),
    };
    selectedRef.current = nextSheet.selected_service_codes;
    setSheet(nextSheet);
  }

  async function save() {
    if (!sheet) return null;
    const serviceCodes = tickedServiceCodes(sheet);
    const next = await saveLeadQuoteSheet(token, leadId, {
      service_codes: serviceCodes,
      lines: linesFromSheet(sheet),
      vat_percent: percentOf(sheet.vat_percent),
      promo_percent: percentOf(sheet.promo_percent),
    });
    setSheet(withComputedAmounts(mergeCatalogGroups(next, sheet)));
    return next;
  }

  async function onSave() {
    setBusy(true);
    setLocalError('');
    try {
      const next = await save();
      if (next) onMessage?.(`Đã lưu bảng báo giá. Tổng ${vnd(next.grand_total_vnd)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không lưu được bảng báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setBusy(true);
    setLocalError('');
    try {
      const next = await save();
      if (!next || next.included_count < 1) {
        throw new Error('Chọn dịch vụ và giữ ít nhất một việc được tính tiền.');
      }
      if (next.missing_staff_count > 0) {
        throw new Error('Gán nhân sự cho từng việc được tính tiền.');
      }
      const out = await sendLeadQuoteToSales(token, leadId);
      onFunnelChange(out.funnel);
      notifyLeadDealFilesChanged();
      onMessage?.(`Đã nộp báo giá, chờ CEO duyệt. Tổng ${vnd(next.grand_total_vnd)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không gửi được báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const submittedForCeo =
    quoteSentToCeo || phase === 'ceo_review' || phase === 'sale_review';
  const editable = Boolean(sheet?.editable) && !viewerIsSales && (!submittedForCeo || viewerIsCeo);
  const submittedView = submittedForCeo || ceoApproved;
  const tableEditable = editable && !submittedView;
  const visibleGroups = (sheet?.groups ?? []).filter((group) => group.rows.some((row) => row.included));
  const tickedCodes = sheet ? tickedServiceCodes(sheet) : [];
  const includedRows =
    sheet?.groups.flatMap((group) =>
      group.rows
        .filter((row) => row.included)
        .map((row) => ({ group, row })),
    ) ?? [];
  const catalogServices = sheet?.services ?? [];
  const tickedSet = new Set(tickedCodes.map((code) => code.trim().toUpperCase()));
  const openSet = new Set(openCodes.map((code) => code.trim().toUpperCase()));
  if (sheet && catalogServices.length) {
    if (!sectionLockRef.current) {
      const primary = new Set<string>();
      const extra = new Set<string>();
      for (const service of catalogServices) {
        const key = service.code.trim().toUpperCase();
        if (tickedSet.has(key)) primary.add(key);
        else extra.add(key);
      }
      sectionLockRef.current = { primary, extra };
    } else {
      for (const service of catalogServices) {
        const key = service.code.trim().toUpperCase();
        if (!sectionLockRef.current.primary.has(key) && !sectionLockRef.current.extra.has(key)) {
          sectionLockRef.current.extra.add(key);
        }
      }
    }
  }
  const lockedPrimary = sectionLockRef.current?.primary;
  const primaryServices = catalogServices.filter((service) => {
    const key = service.code.trim().toUpperCase();
    return lockedPrimary ? lockedPrimary.has(key) : tickedSet.has(key);
  });
  const extraServices = catalogServices.filter((service) => {
    const key = service.code.trim().toUpperCase();
    return lockedPrimary ? !lockedPrimary.has(key) : !tickedSet.has(key);
  });

  function groupsFor(serviceCode: string) {
    const key = serviceCode.trim().toUpperCase();
    return (sheet?.groups ?? []).filter((group) => group.service_code.trim().toUpperCase() === key);
  }

  function serviceLoaded(serviceCode: string): boolean {
    return groupsFor(serviceCode).length > 0;
  }

  async function toggleExtraService(serviceCode: string) {
    const key = serviceCode.trim().toUpperCase();
    if (openSet.has(key)) {
      setOpenCodes((current) => current.filter((code) => code.trim().toUpperCase() !== key));
      setOpenServiceKeys((current) => current.filter((code) => code !== key));
      return;
    }
    if (serviceLoaded(serviceCode)) {
      setOpenCodes((current) => (current.some((code) => code.trim().toUpperCase() === key) ? current : [...current, key]));
      setOpenServiceKeys((current) => (current.includes(key) ? current : [...current, key]));
      return;
    }
    if (!sheet || loadingCode) return;
    setLoadingCode(key);
    setLocalError('');
    try {
      const incoming = await fetchLeadQuoteSheet(token, leadId, [key]);
      setSheet((current) => withComputedAmounts(current ? mergeCatalogGroups(current, incoming) : incoming));
      setOpenCodes((current) => (current.some((code) => code.trim().toUpperCase() === key) ? current : [...current, key]));
      setOpenServiceKeys((current) => (current.includes(key) ? current : [...current, key]));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được dịch vụ';
      setLocalError(message);
      onError?.(message);
    } finally {
      setLoadingCode('');
    }
  }
  const subtotal = includedRows.reduce((sum, item) => sum + amountOf(item.row, sheet?.staff ?? []), 0);
  const promoPercent = percentOf(sheet?.promo_percent ?? 0);
  const vatPercent = percentOf(sheet?.vat_percent ?? 0);
  const promoVnd = Math.round((subtotal * promoPercent) / 100);
  const afterPromo = Math.max(0, subtotal - promoVnd);
  const vatVnd = Math.round((afterPromo * vatPercent) / 100);
  const grand = afterPromo + vatVnd;

  function serviceOpenKey(serviceCode: string): string {
    return serviceCode.trim().toUpperCase();
  }

  function isServiceExpanded(serviceCode: string): boolean {
    return openServiceKeys.includes(serviceOpenKey(serviceCode));
  }

  function toggleServiceExpand(serviceCode: string) {
    const key = serviceOpenKey(serviceCode);
    setOpenServiceKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function renderServiceCard(
    groups: NonNullable<LeadQuoteSheet['groups']>,
    options?: { startExpanded?: boolean },
  ) {
    if (!groups.length) return null;
    const serviceCode = groups[0].service_code;
    const serviceName = groups[0].service_name;
    const expanded = submittedView ? false : Boolean(options?.startExpanded) || isServiceExpanded(serviceCode);
    const allRows = groups.flatMap((group) => group.rows);
    const serviceIncluded = allRows.filter((row) => row.included).length;
    const serviceTotal = allRows.length;
    const hiddenCount = allRows.filter((row) => !row.included).length;
    const canToggle = !submittedView && hiddenCount > 0;
    const visibleGroups = expanded
      ? groups
      : groups.filter((group) => group.rows.some((row) => row.included));
    const showPhaseHeadings = groups.length > 1 || Boolean(groups[0]?.phase_name);
    const hasTable = visibleGroups.some((group) => {
      const rows = expanded ? group.rows : group.rows.filter((row) => row.included);
      return rows.length > 0;
    });

    function toggle() {
      if (!canToggle) return;
      toggleServiceExpand(serviceCode);
    }

    return (
      <div className="quote-sheet__group quote-sheet__service" key={serviceCode}>
        <button
          type="button"
          className="quote-sheet__group-head"
          aria-expanded={canToggle ? expanded : undefined}
          disabled={!canToggle}
          onClick={toggle}
        >
          <span className="quote-sheet__group-icon" aria-hidden="true">
            <QuoteGlyph name={groupGlyph(serviceCode)} size={16} />
          </span>
          <span className="quote-sheet__service-label">
            <span className="quote-sheet__service-title">{serviceName}</span>
            {canToggle ? (
              <span className="quote-sheet__chevron quote-sheet__service-caret" aria-hidden="true">▾</span>
            ) : null}
          </span>
          <span className="quote-sheet__pill" aria-label={`${serviceIncluded} trên ${serviceTotal} hạng mục`}>
            {serviceIncluded}/{serviceTotal}
          </span>
        </button>
        {hasTable ? (
          <table className="quote-sheet__lines">
            <colgroup>
              <col className="quote-sheet__col-check" />
              <col className="quote-sheet__col-task" />
              <col className="quote-sheet__col-subtask" />
              <col className="quote-sheet__col-qty" />
              <col className="quote-sheet__col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th>Tính</th>
                <th>Việc</th>
                <th>Việc nhỏ</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => {
                const key = groupKey(group);
                const includedCount = group.rows.filter((row) => row.included).length;
                const totalCount = group.rows.length;
                const rows = expanded ? group.rows : group.rows.filter((row) => row.included);
                const phaseName = String(group.phase_name ?? '').trim();
                return (
                  <Fragment key={key}>
                    {showPhaseHeadings && phaseName ? (
                      <tr className="quote-sheet__phase">
                        <td colSpan={5}>
                          <div className="quote-sheet__phase-inner">
                            <span className="quote-sheet__phase-name">{phaseName}</span>
                            <span className="quote-sheet__pill" aria-label={`${includedCount} trên ${totalCount} hạng mục`}>
                              {includedCount}/{totalCount}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {rows.map((row) => (
                      <tr key={row.item_code} className={row.included ? undefined : 'is-off'}>
                        <td className="quote-sheet__check">
                          <input
                            type="checkbox"
                            checked={row.included}
                            disabled={!tableEditable || !row.chargeable || busy}
                            aria-label={`Tính tiền ${row.task}`}
                            onChange={(event) => patchRow(row.item_code, { included: event.target.checked })}
                          />
                        </td>
                        <td className="quote-sheet__task">
                          <strong>{row.task}</strong>
                          <span className="muted">{quoteRoleLabel(row.role_label)}</span>
                        </td>
                        <td className="quote-sheet__subtask">{row.subtask || '—'}</td>
                        <td className="quote-sheet__qty">
                          {tableEditable && row.chargeable ? (
                            <input
                              type="number"
                              min={0.01}
                              max={9999}
                              step={1}
                              value={row.qty}
                              aria-label={`Số lượng ${row.task}`}
                              disabled={busy}
                              onChange={(event) => {
                                const qty = Math.max(0, Number(event.target.value) || 0);
                                patchRow(row.item_code, { qty });
                              }}
                            />
                          ) : (
                            row.qty
                          )}
                        </td>
                        <td className="quote-sheet__amount">{vnd(amountOf(row, sheet?.staff ?? []))}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    );
  }

  function renderServiceCards(groups: NonNullable<LeadQuoteSheet['groups']>) {
    const order: string[] = [];
    const buckets = new Map<string, NonNullable<LeadQuoteSheet['groups']>>();
    for (const group of groups) {
      const key = group.service_code.trim().toUpperCase();
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(group);
      } else {
        buckets.set(key, [group]);
        order.push(key);
      }
    }
    return order.map((code) => renderServiceCard(buckets.get(code) ?? []));
  }

  function renderServiceTables(serviceCode: string, options?: { startExpanded?: boolean }) {
    return renderServiceCard(groupsFor(serviceCode), options);
  }

  return (
    <section id="lead-quote-sheet" className="quote-sheet quote-sheet--brand" aria-label="Bảng báo giá">
      <LeadStepHero
        title="BÁO GIÁ"
        icon="quote"
        subtitle={
          phase === 'ceo_review' || phase === 'sale_review'
            ? 'Báo giá đã nộp, đang chờ CEO duyệt.'
            : ceoApproved
              ? 'CEO đã duyệt. Sales có thể xem và tải file Excel.'
              : 'Tick hạng mục cần tính tiền và chọn số lượng. Thành tiền chỉ cộng các dòng đã tick.'
        }
      />
      <ActionErrorToast message={localError} />
      {!sheet && !localError ? <p className="muted">Đang tải bảng báo giá…</p> : null}
      {!sheet && localError ? <p className="muted">{localError}</p> : null}
      {tableEditable ? (
        primaryServices.map((service) => (
          <Fragment key={service.code}>{renderServiceTables(service.code)}</Fragment>
        ))
      ) : (
        renderServiceCards(visibleGroups)
      )}
      {sheet && !submittedView && extraServices.length > 0 ? (
        <div className="quote-sheet__extras">
          <h3 className="quote-sheet__extras-label">Thêm dịch vụ khác</h3>
                    {extraServices.map((service) => {
            const key = service.code.trim().toUpperCase();
            const loaded = serviceLoaded(service.code);
            const loading = loadingCode === key;
            const itemCount = Number(service.item_count) || 0;
            return (
              <div key={service.code} className="quote-sheet__extra">
                {loaded ? (
                  renderServiceTables(service.code)
                ) : (
                  <div className="quote-sheet__group quote-sheet__service">
                    <button
                      type="button"
                      className="quote-sheet__group-head"
                      aria-expanded={false}
                      aria-label={`Mở ${service.name}`}
                      disabled={busy || Boolean(loadingCode)}
                      onClick={() => void toggleExtraService(service.code)}
                    >
                      <span className="quote-sheet__group-icon" aria-hidden="true">
                        <QuoteGlyph name={groupGlyph(service.code)} size={16} />
                      </span>
                      <span className="quote-sheet__service-label">
                        <span className="quote-sheet__service-title">{service.name}</span>
                        <span className="quote-sheet__chevron quote-sheet__service-caret" aria-hidden="true">▾</span>
                      </span>
                      {loading ? (
                        <span className="muted">Đang tải…</span>
                      ) : (
                        <span className="quote-sheet__pill" aria-label={`0 trên ${itemCount} hạng mục`}>
                          0/{itemCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {sheet && (tableEditable || tickedCodes.length > 0) ? (
        <>
          {tableEditable ? (
            <div className="quote-sheet__commercial">
              <label>
                Khuyến mại %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={promoPercent}
                  aria-label="Khuyến mại %"
                  disabled={busy}
                  onChange={(event) => {
                    const promo_percent = percentOf(Number(event.target.value));
                    setSheet((current) => (current ? { ...current, promo_percent } : current));
                  }}
                />
              </label>
              <label>
                VAT %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={vatPercent}
                  aria-label="VAT %"
                  disabled={busy}
                  onChange={(event) => {
                    const vat_percent = percentOf(Number(event.target.value));
                    setSheet((current) => (current ? { ...current, vat_percent } : current));
                  }}
                />
              </label>
            </div>
          ) : null}
          <div className="quote-sheet__totals">
            <div className="quote-sheet__totals-row">
              <span>Tạm tính</span>
              <strong>{vnd(subtotal)}</strong>
            </div>
            <div className="quote-sheet__totals-row">
              <span>Khuyến mại {promoPercent}%</span>
              <span>{vnd(promoVnd)}</span>
            </div>
            <div className="quote-sheet__totals-row">
              <span>VAT {vatPercent}%</span>
              <span>{vnd(vatVnd)}</span>
            </div>
            <div className="quote-sheet__totals-row quote-sheet__grand">
              <span>Tổng thanh toán</span>
              <strong>{vnd(grand)}</strong>
            </div>
          </div>
        </>
      ) : null}
      {(() => {
        const canSubmitQuote =
          !viewerIsSales &&
          !ceoApproved &&
          !submittedForCeo &&
          (editable || phase === 'bao_gia' || phase === 'chuyen_bao_gia' || !phase);
        const submitBlockedReason =
          canSubmitQuote && sheet && tickedCodes.length < 1
            ? 'Chọn ít nhất một hạng mục để nộp.'
            : '';
        const toolbarHidden = submittedForCeo || ceoApproved;
        if (toolbarHidden) {
          return submittedForCeo && !ceoApproved ? (
            <p className="muted quote-sheet__submit-hint">Báo giá đã nộp, đang chờ CEO duyệt.</p>
          ) : null;
        }
        if (!editable && !canSubmitQuote) return null;
        return (
        <>
        <div className="solution-desk__actions">
          {editable ? (
            <button type="button" className="btn btn-secondary" disabled={busy || !sheet} onClick={() => void onSave()}>
              Lưu bảng
            </button>
          ) : null}
          {canSubmitQuote ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="quote-send-ceo"
              disabled={busy || !sheet || tickedCodes.length < 1}
              onClick={() => void onSend()}
            >
              Nộp báo giá cho CEO
            </button>
          ) : null}
        </div>
        {submitBlockedReason ? <p className="muted quote-sheet__submit-hint">{submitBlockedReason}</p> : null}
        </>
        );
      })()}
    </section>
  );
}

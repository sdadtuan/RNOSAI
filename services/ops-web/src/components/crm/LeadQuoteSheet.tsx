'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadLeadQuoteXlsx,
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLeadQuoteSheet,
  saveLeadQuoteSheet,
  sendLeadQuoteToSales,
  type LeadFunnelSnapshot,
  type LeadQuoteSheet,
  type LeadQuoteSheetRow,
} from '@/lib/api';
import { ActionErrorToast } from '@/components/ui/ActionToast';
import { readIntakeP13Scope } from '@/lib/crm/intake-p13-scope';
import { suggestQuotePrefillFromDiscovery } from '@/lib/crm/quote-discovery-prefill';
import { quoteRoleLabel, quoteUnitLabel } from '@/lib/crm/quote-unit-label';
import { readDiscoveryBriefFromAnswers } from '@/lib/crm/sales-discovery';

const MAX_QUOTE_SERVICES = 4;

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

function amountOf(
  row: Pick<LeadQuoteSheetRow, 'included' | 'chargeable' | 'hours' | 'qty' | 'hourly_vnd'>,
): number {
  if (!row.included || !row.chargeable) return 0;
  return Math.round((row.hours || 0) * (row.qty || 0) * (row.hourly_vnd || 0));
}

function quoteHasExistingItems(sheet: LeadQuoteSheet): boolean {
  if ((sheet.selected_service_codes ?? []).length > 0) return true;
  return sheet.groups.some((group) => group.rows.some((row) => row.included));
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
          return { ...next, amount_vnd: amountOf(next) };
        }
        const included = Boolean(row.chargeable && includeItemCodes?.has(row.item_code));
        const next = { ...row, included };
        return { ...next, amount_vnd: amountOf(next) };
      }),
    })),
  };
}

export function LeadQuoteSheet({
  token,
  leadId,
  phase,
  viewerIsSales = false,
  onFunnelChange,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  phase: string;
  viewerIsSales?: boolean;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
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

  const canDownload = ceoApproved || (!viewerIsSales && (phase === 'ceo_review' || phase === 'sale_review'));

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
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
            if (!current) return next;
            return {
              ...next,
              selected_service_codes: current.selected_service_codes,
              vat_percent: current.vat_percent,
              promo_percent: current.promo_percent,
              groups: current.groups.length > 0 ? current.groups : next.groups,
            };
          });
          return;
        }

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

        const canPrefill = !prefilledRef.current && !quoteHasExistingItems(next) && (discoveryServices.length > 0 || Boolean(p13Scope?.service_code));
        if (canPrefill) {
          const firstPass = suggestQuotePrefillFromDiscovery({
            discoveryServices,
            serviceGroups: options?.service_groups,
            quoteServices: next.services,
            quoteItems: [],
            p13Scope,
          });
          if (firstPass.serviceCodes.length > 0) {
            prefilledRef.current = true;
            const codes = firstPass.serviceCodes.slice(0, MAX_QUOTE_SERVICES);
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
            setSheet(applied);
            return;
          }
        }

        setSheet(next);
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
  }, [visible, token, leadId, phase]);

  const staffGroups = useMemo(() => {
    const order = ['AE', 'GDKD', 'MKL'];
    return order
      .map((code) => ({
        code,
        name: sheet?.staff.find((person) => person.position_code === code)?.position_name ?? code,
        people: sheet?.staff.filter((person) => person.position_code === code) ?? [],
      }))
      .filter((group) => group.people.length > 0);
  }, [sheet]);

  if (!visible) return null;

  async function loadServices(codes: string[], includeItemCodes: Set<string> | null = null) {
    if (!sheet) return;
    const previous = sheet.selected_service_codes;
    selectedRef.current = codes;
    setSheet((current) => (current ? { ...current, selected_service_codes: codes } : current));
    setBusy(true);
    setLocalError('');
    try {
      const next = await fetchLeadQuoteSheet(token, leadId, codes);
      setSheet(applyLoadedSheet({
        ...next,
        selected_service_codes: next.selected_service_codes?.length ? next.selected_service_codes : codes,
      }, sheet, includeItemCodes));
    } catch (err) {
      selectedRef.current = previous;
      setSheet((current) => (current ? { ...current, selected_service_codes: previous } : current));
      const message = err instanceof Error ? err.message : 'Không tải được việc của dịch vụ';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  function patchRow(itemCode: string, patch: Partial<LeadQuoteSheetRow>) {
    setSheet((current) => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => {
            if (row.item_code !== itemCode) return row;
            const next = { ...row, ...patch };
            return { ...next, amount_vnd: amountOf(next) };
          }),
        })),
      };
    });
  }

  function toggleService(code: string, want: boolean) {
    if (!sheet) return;
    if (want) {
      if (sheet.selected_service_codes.includes(code)) return;
      if (sheet.selected_service_codes.length >= MAX_QUOTE_SERVICES) return;
      void loadServices([...sheet.selected_service_codes, code], null);
      return;
    }
    void loadServices(
      sheet.selected_service_codes.filter((item) => item !== code),
      null,
    );
  }

  async function save() {
    if (!sheet) return null;
    const next = await saveLeadQuoteSheet(token, leadId, {
      service_codes: sheet.selected_service_codes,
      lines: linesFromSheet(sheet),
      vat_percent: percentOf(sheet.vat_percent),
      promo_percent: percentOf(sheet.promo_percent),
    });
    setSheet(next);
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
      onMessage?.(`Đã nộp báo giá, chờ CEO duyệt. Tổng ${vnd(next.grand_total_vnd)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không gửi được báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const editable = Boolean(sheet?.editable) && !viewerIsSales;
  const includedRows =
    sheet?.groups.flatMap((group) =>
      group.rows
        .filter((row) => row.included)
        .map((row) => ({ group, row })),
    ) ?? [];
  const subtotal = includedRows.reduce((sum, item) => sum + item.row.amount_vnd, 0);
  const promoPercent = percentOf(sheet?.promo_percent ?? 0);
  const vatPercent = percentOf(sheet?.vat_percent ?? 0);
  const promoVnd = Math.round((subtotal * promoPercent) / 100);
  const afterPromo = Math.max(0, subtotal - promoVnd);
  const vatVnd = Math.round((afterPromo * vatPercent) / 100);
  const grand = afterPromo + vatVnd;

  async function onDownload() {
    setBusy(true);
    setLocalError('');
    try {
      await downloadLeadQuoteXlsx(token, leadId);
      onMessage?.('Đã tải Excel báo giá.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được Excel báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="lead-quote-sheet" className="quote-sheet" aria-label="Bảng báo giá">
      <header className="quote-sheet__head">
        <p className="solution-desk__kicker">Bảng báo giá</p>
        <p className="muted">
          {phase === 'ceo_review' || phase === 'sale_review'
            ? 'Báo giá đã nộp, đang chờ CEO duyệt.'
            : ceoApproved
              ? 'CEO đã duyệt. Sales có thể xem và tải file Excel.'
              : 'Tick hạng mục cần tính tiền, chọn nhân sự và số lượng. Thành tiền chỉ cộng các dòng đã tick.'}
        </p>
      </header>
      <ActionErrorToast message={localError} />
      {!sheet && !localError ? <p className="muted">Đang tải catalog và nhân sự…</p> : null}
      {!sheet && localError ? <p className="muted">{localError}</p> : null}
      {sheet && editable ? (
        <div className="quote-sheet__services" data-testid="quote-service-picker">
          {sheet.services.map((service) => {
            const selected = sheet.selected_service_codes.includes(service.code);
            const atLimit = !selected && sheet.selected_service_codes.length >= MAX_QUOTE_SERVICES;
            return (
              <label key={service.code} className="quote-sheet__svc-pick" data-testid={`quote-svc-label-${service.code}`}>
                <input
                  type="checkbox"
                  data-testid={`quote-svc-${service.code}`}
                  checked={selected}
                  disabled={busy || atLimit}
                  aria-label={`Chọn dịch vụ ${service.name}`}
                  onChange={(event) => toggleService(service.code, event.target.checked)}
                />
                <span>{service.name}</span>
              </label>
            );
          })}
        </div>
      ) : null}
      {sheet?.groups.map((group) => (
        <div key={`${group.service_code}-${group.phase_code}`} className="quote-sheet__group">
          <h3>
            {group.service_name}
            {group.phase_name ? ` - ${group.phase_name}` : ''}
          </h3>
          <table className="quote-sheet__lines">
            <colgroup>
              <col className="quote-sheet__col-check" />
              <col className="quote-sheet__col-task" />
              <col className="quote-sheet__col-subtask" />
              <col className="quote-sheet__col-staff" />
              <col className="quote-sheet__col-qty" />
              <col className="quote-sheet__col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th>Tính</th>
                <th>Việc</th>
                <th>Việc nhỏ</th>
                <th>Nhân sự</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.item_code} className={row.included ? undefined : 'is-off'}>
                  <td className="quote-sheet__check">
                    <input
                      type="checkbox"
                      checked={row.included}
                      disabled={!editable || !row.chargeable || busy}
                      aria-label={`Tính tiền ${row.task}`}
                      onChange={(event) => patchRow(row.item_code, { included: event.target.checked })}
                    />
                  </td>
                  <td className="quote-sheet__task">
                    <strong>{row.task}</strong>
                    <span className="muted">{quoteRoleLabel(row.role_label)}</span>
                  </td>
                  <td className="quote-sheet__subtask">{row.subtask || '—'}</td>
                  <td className="quote-sheet__staff">
                    {editable && row.chargeable ? (
                      <select
                        value={row.staff_id ?? ''}
                        aria-label={`Nhân sự ${row.task}`}
                        disabled={busy}
                        onChange={(event) => {
                          const staffId = Number(event.target.value);
                          const person = sheet.staff.find((item) => item.id === staffId);
                          patchRow(row.item_code, {
                            staff_id: person?.id ?? null,
                            staff_name: person?.name ?? '',
                            position_name: person?.position_name ?? '',
                            monthly_salary_vnd: person?.monthly_salary_vnd ?? 0,
                            hours_per_month: person?.hours_per_month ?? 0,
                            hourly_vnd: person?.hourly_vnd ?? 0,
                          });
                        }}
                      >
                        <option value="">Chọn nhân sự</option>
                        {staffGroups.map((staffGroup) => (
                          <optgroup key={staffGroup.code} label={staffGroup.name}>
                            {staffGroup.people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      row.staff_name.trim() ? row.staff_name.toLocaleUpperCase('vi-VN') : '—'
                    )}
                  </td>
                  <td className="quote-sheet__qty">
                    {editable && row.chargeable ? (
                      <>
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
                        {row.unit ? <span className="muted">{quoteUnitLabel(row.unit)}</span> : null}
                      </>
                    ) : (
                      <>
                        {row.qty}
                        {row.unit ? ` ${quoteUnitLabel(row.unit)}` : ''}
                      </>
                    )}
                  </td>
                  <td className="quote-sheet__amount">{row.included ? vnd(row.amount_vnd) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {sheet && sheet.selected_service_codes.length < 1 && editable ? (
        <p className="muted">Chưa chọn dịch vụ. Tick dịch vụ ở trên, rồi tick từng việc trong bảng.</p>
      ) : null}
      {sheet && sheet.selected_service_codes.length > 0 ? (
        <>
          {editable ? (
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
            <div>Tạm tính <strong>{vnd(subtotal)}</strong></div>
            <div>Khuyến mại {promoPercent}%: {vnd(promoVnd)}</div>
            <div>VAT {vatPercent}%: {vnd(vatVnd)}</div>
            <div className="quote-sheet__grand">Tổng thanh toán {vnd(grand)}</div>
          </div>
        </>
      ) : null}
      {editable || canDownload ? (
        <div className="solution-desk__actions">
          {editable ? (
            <>
              <button type="button" className="btn btn-secondary" disabled={busy || !sheet} onClick={() => void onSave()}>
                Lưu bảng
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="quote-send-ceo"
                disabled={busy || !sheet || sheet.selected_service_codes.length < 1}
                onClick={() => void onSend()}
              >
                Nộp báo giá cho CEO
              </button>
            </>
          ) : null}
          {canDownload ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onDownload()}>
              Tải Excel báo giá
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

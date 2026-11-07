'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  downloadLeadQuoteDocx,
  fetchLeadQuoteSheet,
  saveLeadQuoteSheet,
  sendLeadQuoteToSales,
  type LeadFunnelSnapshot,
  type LeadQuoteSheet,
  type LeadQuoteSheetRow,
} from '@/lib/api';

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
      included: row.included,
    })),
  );
}

export function LeadQuoteSheet({
  token,
  leadId,
  phase,
  onFunnelChange,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  phase: string;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const visible = phase === 'bao_gia' || phase === 'sale_review';
  const [sheet, setSheet] = useState<LeadQuoteSheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLocalError('');
    void fetchLeadQuoteSheet(token, leadId)
      .then((next) => {
        if (!cancelled) setSheet(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLocalError(err instanceof Error ? err.message : 'Không tải được bảng báo giá');
      });
    return () => {
      cancelled = true;
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

  async function loadServices(codes: string[]) {
    if (!sheet) return;
    const edits = new Map(linesFromSheet(sheet).map((line) => [line.item_code, line]));
    setBusy(true);
    setLocalError('');
    try {
      const next = await fetchLeadQuoteSheet(token, leadId, codes);
      setSheet({
        ...next,
        vat_percent: sheet.vat_percent,
        promo_percent: sheet.promo_percent,
        groups: next.groups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => {
            const edit = edits.get(row.item_code);
            if (!edit) return row;
            const person = next.staff.find((item) => item.id === edit.staff_id);
            const hourly = person?.hourly_vnd ?? row.hourly_vnd;
            return {
              ...row,
              staff_id: person?.id ?? null,
              staff_name: person?.name ?? '',
              position_name: person?.position_name ?? '',
              monthly_salary_vnd: person?.monthly_salary_vnd ?? 0,
              hours_per_month: person?.hours_per_month ?? 0,
              hourly_vnd: hourly,
              hours: edit.hours,
              included: row.chargeable ? edit.included : false,
              amount_vnd: row.chargeable && edit.included ? Math.round(edit.hours * row.qty * hourly) : 0,
            };
          }),
        })),
      });
    } catch (err) {
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
          rows: group.rows.map((row) => (row.item_code === itemCode ? { ...row, ...patch } : row)),
        })),
      };
    });
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
      onMessage?.(`Đã gửi báo giá cho Sale. Tổng ${vnd(next.grand_total_vnd)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không gửi được báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const editable = Boolean(sheet?.editable);
  const subtotal = sheet?.groups.reduce(
    (sum, group) => sum + group.rows.reduce((inner, row) => inner + (row.included ? row.amount_vnd : 0), 0),
    0,
  ) ?? 0;
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
      await downloadLeadQuoteDocx(token, leadId);
      onMessage?.('Đã tải Word báo giá.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được Word báo giá';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="quote-sheet" aria-label="Bảng báo giá">
      <header className="quote-sheet__head">
        <p className="solution-desk__kicker">Bảng báo giá</p>
        <p className="muted">Việc nhỏ lấy từ mô tả catalog.</p>
      </header>
      {localError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {localError}
        </div>
      ) : null}
      {!sheet ? <p className="muted">Đang tải catalog và nhân sự…</p> : null}
      {sheet && editable ? (
        <div className="quote-sheet__services">
          {sheet.services.map((service) => {
            const checked = sheet.selected_service_codes.includes(service.code);
            return (
              <label key={service.code}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy || (!checked && sheet.selected_service_codes.length >= 4)}
                  onChange={() => {
                    const next = checked
                      ? sheet.selected_service_codes.filter((code) => code !== service.code)
                      : [...sheet.selected_service_codes, service.code];
                    void loadServices(next);
                  }}
                />
                {service.name}
              </label>
            );
          })}
        </div>
      ) : null}
      {sheet && sheet.selected_service_codes.length > 0 ? (
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
              disabled={!editable || busy}
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
              disabled={!editable || busy}
              onChange={(event) => {
                const vat_percent = percentOf(Number(event.target.value));
                setSheet((current) => (current ? { ...current, vat_percent } : current));
              }}
            />
          </label>
        </div>
      ) : null}
      {sheet?.groups.map((group) => (
        <div key={`${group.service_code}-${group.phase_code}`} className="quote-sheet__group">
          <h3>
            {group.service_name} · {group.phase_name}
          </h3>
          <div className="quote-sheet__scroll">
            <table>
              <colgroup>
                <col className="quote-sheet__col-check" />
                <col className="quote-sheet__col-task" />
                <col className="quote-sheet__col-subtask" />
                <col className="quote-sheet__col-staff" />
                <col className="quote-sheet__col-amount" />
              </colgroup>
              <thead>
                <tr>
                  <th>Tính</th>
                  <th>Việc</th>
                  <th>Việc nhỏ</th>
                  <th>Nhân sự</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.item_code}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.included}
                        disabled={!editable || !row.chargeable || busy}
                        aria-label={`Tính tiền ${row.task}`}
                        onChange={(event) => patchRow(row.item_code, { included: event.target.checked })}
                      />
                    </td>
                    <td>
                      <strong>{row.task}</strong>
                      <span className="muted">{row.role_label}</span>
                    </td>
                    <td>{row.subtask || '—'}</td>
                    <td>
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
                              amount_vnd: row.included
                                ? Math.round(row.hours * row.qty * (person?.hourly_vnd ?? 0))
                                : 0,
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
                        row.staff_name || '—'
                      )}
                    </td>
                    <td>{row.included ? vnd(row.amount_vnd) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {sheet && sheet.selected_service_codes.length > 0 ? (
        <p>
          Tạm tính {vnd(subtotal)}
          <br />
          Khuyến mại {promoPercent}%: {vnd(promoVnd)}
          <br />
          VAT {vatPercent}%: {vnd(vatVnd)}
          <br />
          <strong>Tổng thanh toán {vnd(grand)}</strong>
        </p>
      ) : null}
      {phase === 'sale_review' ? (
        <div className="solution-desk__actions">
          <button type="button" className="btn btn-secondary" disabled={busy || !sheet} onClick={() => void onDownload()}>
            Tải Word báo giá
          </button>
        </div>
      ) : null}
      {editable ? (
        <div className="solution-desk__actions">
          <button type="button" className="btn btn-secondary" disabled={busy || !sheet} onClick={() => void onSave()}>
            Lưu bảng
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !sheet} onClick={() => void onSend()}>
            Nộp báo giá cho Sale
          </button>
        </div>
      ) : null}
    </section>
  );
}

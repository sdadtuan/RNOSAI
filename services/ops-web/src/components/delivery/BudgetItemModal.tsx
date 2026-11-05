'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createBudgetItem, previewBudgetImpact, type BudgetItemBody } from '@/lib/delivery-projects-api';
import type { BudgetItemRow } from './WizardBudgetStep';

type BudgetItemModalProps = {
  token: string;
  projectId: string;
  projectCode?: string | null;
  projectName: string;
  serviceCodes: string[];
  onClose: () => void;
  onSaved: (item: BudgetItemRow) => void;
};

const KINDS: BudgetItemBody['kind'][] = ['labor', 'production', 'software', 'media', 'other'];

export function BudgetItemModal({
  token,
  projectId,
  projectCode,
  projectName,
  serviceCodes,
  onClose,
  onSaved,
}: BudgetItemModalProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BudgetItemBody['kind']>('labor');
  const [mediaBorne, setMediaBorne] = useState<'agency_borne' | 'client_borne'>('agency_borne');
  const [serviceCode, setServiceCode] = useState(serviceCodes[0] ?? '');
  const [approved, setApproved] = useState('');
  const [forecast, setForecast] = useState('');
  const [allocMethod, setAllocMethod] = useState<'even' | 'milestone' | 'manual'>('even');
  const [impact, setImpact] = useState<{
    margin_before: string | null;
    margin_after: string | null;
    policy_critical: boolean;
    forecast_over_budget: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draftBody = (): BudgetItemBody => ({
    name: name.trim(),
    kind,
    media_borne: kind === 'media' ? mediaBorne : null,
    service_code: serviceCode || null,
    approved_budget: approved || '0',
    forecast: forecast || '0',
    allocation_method: allocMethod,
  });

  useEffect(() => {
    if (!forecast.trim()) {
      setImpact(null);
      return;
    }
    const timer = setTimeout(() => {
      void previewBudgetImpact(token, projectId, draftBody())
        .then(setImpact)
        .catch(() => setImpact(null));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectId, name, kind, mediaBorne, serviceCode, approved, forecast, allocMethod]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const item = await createBudgetItem(token, projectId, draftBody());
      onSaved({
        id: item.id,
        name: item.name,
        kind: item.kind,
        media_borne: item.media_borne,
        service_code: item.service_code,
        approved_budget: item.approved_budget,
        forecast: item.forecast,
        actual: item.actual,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }, [onSaved, projectId, token]);

  return (
    <div className="delivery-modal-overlay" role="dialog" aria-modal="true" data-testid="budget-item-modal">
      <div className="delivery-modal">
        <header className="delivery-modal__head">
          <p className="delivery-budget-banner">
            {projectCode ?? 'PRJ-xxx'} • {projectName}
          </p>
          <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="delivery-modal__body delivery-modal__split">
          <div>
            <label className="form-field">
              Tên hạng mục
              <input className="delivery-filter-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="form-field">
              Nhóm dịch vụ
              <select className="delivery-filter-input" value={serviceCode} onChange={(e) => setServiceCode(e.target.value)}>
                {serviceCodes.length === 0 ? <option value="">—</option> : null}
                {serviceCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div className="delivery-segmented">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`delivery-chip${kind === k ? ' delivery-chip--active' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>

            {kind === 'media' ? (
              <div className="delivery-segmented">
                <button
                  type="button"
                  className={`delivery-chip${mediaBorne === 'agency_borne' ? ' delivery-chip--active' : ''}`}
                  onClick={() => setMediaBorne('agency_borne')}
                >
                  Agency borne
                </button>
                <button
                  type="button"
                  className={`delivery-chip${mediaBorne === 'client_borne' ? ' delivery-chip--active' : ''}`}
                  onClick={() => setMediaBorne('client_borne')}
                >
                  Client borne
                </button>
              </div>
            ) : null}

            <div className="delivery-budget-mini-cards">
              <label>
                Approved
                <input className="delivery-filter-input" value={approved} onChange={(e) => setApproved(e.target.value)} />
              </label>
              <label>
                Forecast
                <input className="delivery-filter-input" value={forecast} onChange={(e) => setForecast(e.target.value)} />
              </label>
              <label>
                Actual
                <input className="delivery-filter-input" value="0" disabled />
              </label>
            </div>

            <fieldset className="delivery-budget-alloc">
              <legend>Phân bổ</legend>
              {(['even', 'milestone', 'manual'] as const).map((m) => (
                <label key={m}>
                  <input type="radio" name="alloc" checked={allocMethod === m} onChange={() => setAllocMethod(m)} />
                  {m}
                </label>
              ))}
            </fieldset>
          </div>

          <aside className="delivery-modal__impact">
            <h4>Tác động</h4>
            {impact ? (
              <>
                <p>
                  Margin: {impact.margin_before ?? '—'} → {impact.margin_after ?? '—'}
                </p>
                {impact.policy_critical ? (
                  <p className="delivery-budget-alert">Sẽ gửi Finance phê duyệt</p>
                ) : null}
                {impact.forecast_over_budget ? <p className="delivery-budget-alert">Forecast vượt ngân sách</p> : null}
              </>
            ) : (
              <p className="delivery-empty-hint">Nhập forecast để xem tác động</p>
            )}
            <Link href="/crm/kpi-hub/settings" className="delivery-link">
              Xem chính sách tài chính
            </Link>
          </aside>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <footer className="delivery-modal__footer">
          <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="delivery-btn delivery-btn--secondary" disabled={busy} onClick={() => void save()}>
            Lưu nháp
          </button>
          <button type="button" className="delivery-btn delivery-btn--primary" disabled={busy || !name.trim()} onClick={() => void save()}>
            Thêm hạng mục ngân sách
          </button>
        </footer>
      </div>
    </div>
  );
}

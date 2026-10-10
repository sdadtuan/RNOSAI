'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchP13Service, fetchP13Services, type P13Item, type P13ServiceDetail, type P13ServiceRow } from '@/lib/p13/api';
import { p13CodeForIntakeService } from '@/lib/crm/p13-intake-service';
import { toggleScopeItem, type IntakeP13Scope } from '@/lib/crm/intake-p13-scope';

export type IntakeP13CatalogDialogProps = {
  open: boolean;
  token: string;
  serviceSlug: string;
  serviceLabel: string;
  savedScope?: IntakeP13Scope | null;
  saving?: boolean;
  onSave: (scope: IntakeP13Scope & { service_name?: string }) => Promise<void> | void;
  onClose: () => void;
};

function phaseName(detail: P13ServiceDetail, code: string): string {
  return detail.phases.find((row) => row.code === code)?.name || code;
}

function groupItems(items: P13Item[], phases: P13ServiceDetail['phases']): Array<{ code: string; name: string; items: P13Item[] }> {
  const order = phases.map((row) => row.code);
  const buckets = new Map<string, P13Item[]>();
  for (const item of items) {
    const key = item.phase_code || '—';
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  return keys.map((code) => ({ code, name: phaseName({ phases } as P13ServiceDetail, code), items: buckets.get(code) ?? [] }));
}

export function IntakeP13CatalogDialog({
  open,
  token,
  serviceSlug,
  serviceLabel,
  savedScope = null,
  saving = false,
  onSave,
  onClose,
}: IntakeP13CatalogDialogProps) {
  const [services, setServices] = useState<P13ServiceRow[]>([]);
  const [activeCode, setActiveCode] = useState('');
  const [detail, setDetail] = useState<P13ServiceDetail | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const savedScopeRef = useRef(savedScope);
  savedScopeRef.current = savedScope;

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setDetail(null);
    void (async () => {
      try {
        const rows = await fetchP13Services(token);
        if (cancelled) return;
        setServices(rows);
        const stored = savedScopeRef.current;
        const mapped = p13CodeForIntakeService({ slug: serviceSlug, label: serviceLabel }, rows) ?? '';
        const storedCode =
          stored?.service_code && rows.some((row) => row.code.toUpperCase() === stored.service_code)
            ? stored.service_code
            : '';
        const code = mapped || storedCode;
        setActiveCode(code);
        setSelected(code && stored?.service_code === code ? stored.item_codes : []);
        if (!code) return;
        const next = await fetchP13Service(token, code);
        if (!cancelled) setDetail(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được danh mục');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, serviceLabel, serviceSlug, token]);

  async function choose(code: string) {
    setActiveCode(code);
    setSelected(savedScope?.service_code === code ? savedScope.item_codes : []);
    if (!code || !token) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setDetail(await fetchP13Service(token, code));
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Không tải được hạng mục');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const groups = detail ? groupItems(detail.items, detail.phases) : [];

  return (
    <div className="ai-dismiss-modal" role="presentation" onClick={onClose}>
      <div
        className="ai-dismiss-modal__panel intake-p13-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-p13-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 id="intake-p13-modal-title">Hạng mục · {serviceLabel}</h4>
        <label className="stack-gap" style={{ display: 'grid', gap: '0.35rem', margin: '0.75rem 0' }}>
          <span className="muted">Dịch vụ trong danh mục</span>
          <select
            className="kpi-select"
            aria-label="Dịch vụ danh mục"
            value={activeCode}
            onChange={(event) => void choose(event.target.value)}
          >
            <option value="">Chọn dịch vụ</option>
            {services.map((row) => (
              <option key={row.code} value={row.code}>
                {row.code} · {row.name} ({row.item_count})
              </option>
            ))}
          </select>
        </label>
        {loading ? <p className="muted">Đang tải hạng mục…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {detail ? (
          <div className="intake-p13-modal__list">
            <p className="muted" style={{ marginTop: 0 }}>
              {detail.name} · {detail.items.length} hạng mục
            </p>
            {groups.map((group) => (
              <section key={group.code}>
                <h5 className="intake-p13-modal__phase">
                  {group.code} · {group.name}
                </h5>
                <ul className="intake-p13-modal__items">
                  {group.items.map((item) => (
                    <li key={item.code}>
                      <label className="intake-p13-modal__check">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.code)}
                          aria-label={item.code}
                          onChange={(event) =>
                            setSelected((current) => toggleScopeItem(current, item.code, event.target.checked))
                          }
                        />
                        <span>
                          <strong>{item.code}</strong> {item.task}
                          {item.client_only ? <span className="muted"> · Khách thực hiện</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
        <div className="ai-dismiss-modal__actions">
          <span className="muted" style={{ marginRight: 'auto' }}>
            Đã chọn {selected.length} hạng mục
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !activeCode}
            onClick={() =>
              void onSave({
                service_code: activeCode,
                item_codes: selected,
                service_name: detail?.name,
              })
            }
          >
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

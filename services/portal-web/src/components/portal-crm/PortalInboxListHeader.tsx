'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type InboxFilterOption = { value: string; label: string };
export type InboxFilterSlot = {
  key: string;
  aria: string;
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: InboxFilterOption[];
  hidden?: boolean;
};
export type InboxListPill = { id: string; label: string; count?: number };

function InboxPills({
  pills,
  pillsAria,
  activePill,
  onPill,
}: {
  pills: InboxListPill[];
  pillsAria: string;
  activePill: string;
  onPill: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [fit, setFit] = useState(pills.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;

    const compute = () => {
      const avail = wrap.clientWidth;
      const kids = Array.from(measure.children) as HTMLElement[];
      // last child is the "Thêm" button used only for its width
      if (kids.length < 2) {
        setFit(pills.length);
        return;
      }
      const moreW = kids[kids.length - 1].offsetWidth;
      const gap = 4;
      const pillEls = kids.slice(0, -1);
      const widths = pillEls.map((el) => el.offsetWidth);
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i += 1) {
        const remaining = widths.length - (i + 1);
        const needMore = remaining > 0;
        const next = widths[i] + (count > 0 ? gap : 0);
        const withMore = used + next + (needMore ? gap + moreW : 0);
        if (withMore <= avail + 0.5) {
          used += next;
          count += 1;
        } else {
          break;
        }
      }
      // If everything fits without the Thêm button
      const total = widths.reduce((s, w, i) => s + w + (i ? gap : 0), 0);
      setFit(total <= avail + 0.5 ? widths.length : Math.max(1, count));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [pills]);

  useEffect(() => {
    setMenuOpen(false);
  }, [activePill, pills]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      const root = wrapRef.current?.parentElement;
      if (root && !root.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Keep the active pill among the visible ones when it would otherwise hide.
  let visibleCount = Math.min(fit, pills.length);
  const overflow = pills.slice(visibleCount);
  if (overflow.some((p) => p.id === activePill) && visibleCount > 0) {
    const active = pills.find((p) => p.id === activePill);
    const head = pills.slice(0, visibleCount - 1).filter((p) => p.id !== activePill);
    const vis = active ? [...head, active] : pills.slice(0, visibleCount);
    const hid = pills.filter((p) => !vis.some((v) => v.id === p.id));
    return render(vis, hid);
  }
  return render(pills.slice(0, visibleCount), overflow);

  function render(visible: InboxListPill[], hidden: InboxListPill[]) {
    return (
      <div className="tram-inbox__pills-wrap">
        <div ref={wrapRef} className="tram-inbox__pills" role="group" aria-label={pillsAria}>
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePill === item.id ? 'tram-inbox__pill is-on' : 'tram-inbox__pill'}
              onClick={() => onPill(item.id)}
            >
              {item.label}
              {item.count ? <span>{item.count}</span> : null}
            </button>
          ))}
          {hidden.length ? (
            <div className="tram-inbox__pill-more">
              <button
                type="button"
                className={hidden.some((p) => p.id === activePill) ? 'tram-inbox__pill is-on' : 'tram-inbox__pill'}
                ref={moreBtnRef}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setMenuOpen((v) => {
                    const next = !v;
                    if (next && moreBtnRef.current) {
                      const r = moreBtnRef.current.getBoundingClientRect();
                      const width = 168;
                      setMenuStyle({
                        position: 'fixed',
                        top: r.bottom + 4,
                        left: Math.max(8, r.right - width),
                        width,
                        zIndex: 80,
                      });
                    }
                    return next;
                  });
                }}
              >
                Thêm ▾
              </button>
            </div>
          ) : null}
        </div>
        {hidden.length && menuOpen ? (
          <div className="tram-inbox__pill-menu" role="menu" style={menuStyle}>
            {hidden.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={activePill === item.id ? 'is-on' : undefined}
                onClick={() => {
                  onPill(item.id);
                  setMenuOpen(false);
                }}
              >
                {item.label}
                {item.count != null ? <span>{item.count}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={measureRef} className="tram-inbox__pills is-measure" aria-hidden>
          {pills.map((item) => (
            <button key={item.id} type="button" className="tram-inbox__pill" tabIndex={-1}>
              {item.label}
              {item.count ? <span>{item.count}</span> : null}
            </button>
          ))}
          <button type="button" className="tram-inbox__pill" tabIndex={-1}>
            Thêm ▾
          </button>
        </div>
      </div>
    );
  }
}

export function PortalInboxListHeader({
  tabs,
  title,
  countLabel,
  headerActions,
  refreshLabel,
  onRefresh,
  busy = false,
  query,
  onQuery,
  searchPlaceholder,
  searchAria,
  pills,
  pillsAria,
  activePill,
  onPill,
  slots,
  filtering = false,
  onClear,
}: {
  tabs: ReactNode;
  title: string;
  countLabel: string;
  headerActions?: ReactNode;
  refreshLabel: string;
  onRefresh: () => void;
  busy?: boolean;
  query: string;
  onQuery: (value: string) => void;
  searchPlaceholder: string;
  searchAria: string;
  pills: InboxListPill[];
  pillsAria: string;
  activePill: string;
  onPill: (id: string) => void;
  slots: InboxFilterSlot[];
  filtering?: boolean;
  onClear?: () => void;
}) {
  const visibleSlots = slots.filter((slot) => !slot.hidden);
  return (
    <form
      className="tram-inbox__filters tram-inbox__filters--lock"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="tram-inbox__tabs-slot">{tabs}</div>
      <div className="tram-inbox__filters-head">
        <div>
          <h1>{title}</h1>
          <span className="tram-inbox__count">{countLabel}</span>
        </div>
        <div className="tram-inbox__header-actions">{headerActions}</div>
      </div>
      <div className="tram-inbox__refresh-row">
        <span className="tram-inbox__hint tram-inbox__refresh-label">{refreshLabel || '\u00a0'}</span>
        <button type="button" className="tram-inbox__clear" disabled={busy} onClick={onRefresh}>
          Làm mới
        </button>
      </div>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchAria}
      />
      <InboxPills pills={pills} pillsAria={pillsAria} activePill={activePill} onPill={onPill} />
      <div className="tram-inbox__filter-grid tram-inbox__filter-grid--lock">
        {visibleSlots.map((slot) => (
          <select
            key={slot.key}
            value={slot.value}
            onChange={(event) => slot.onChange(event.target.value)}
            aria-label={slot.aria}
            title={slot.emptyLabel}
          >
            <option value="">{slot.emptyLabel}</option>
            {slot.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      {filtering ? (
        <div className="tram-inbox__clear-slot">
          <button type="button" className="tram-inbox__clear" onClick={onClear}>
            Xóa lọc
          </button>
        </div>
      ) : null}
    </form>
  );
}

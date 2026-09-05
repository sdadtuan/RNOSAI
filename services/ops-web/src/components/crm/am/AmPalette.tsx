'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fetchAmSearch, type AmSearchGroup, type AmSearchItem } from '@/lib/crm/am-api';
import { useAmPage } from './AmShell';

const GROUP_LABEL: Record<AmSearchGroup, string> = {
  account: 'Account',
  contract: 'Hợp đồng',
  task: 'Việc',
};

type AmPaletteProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function AmPalette({ open, onOpen, onClose }: AmPaletteProps) {
  const router = useRouter();
  const { token, scope, canEdit, openCreate } = useAmPage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AmSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const needle = q.trim();
  const groups = useMemo(() => {
    const order: AmSearchGroup[] = ['account', 'contract', 'task'];
    return order
      .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
      .filter((block) => block.items.length > 0);
  }, [items]);

  useEffect(() => {
    function onKey(ev: globalThis.KeyboardEvent) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        onOpen();
        return;
      }
      if (open && ev.key === 'Escape') {
        ev.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onOpen, open]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setItems([]);
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (needle.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      void fetchAmSearch(token, { q: needle, scope })
        .then((out) => {
          if (cancelled) return;
          setItems(out.items ?? []);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [needle, open, scope, token]);

  function openItem(item: AmSearchItem) {
    onClose();
    router.push(item.href);
  }

  function onInputKey(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      onClose();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const hit = items[active] ?? items[0];
      if (hit) openItem(hit);
    }
  }

  if (!open) return null;

  let flat = -1;

  return (
    <div className="am-palette-bg" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="am-palette" role="dialog" aria-modal="true" aria-label="Tìm kiếm Account Management">
        <div className="am-palette__head">
          <b>Tìm kiếm trong CRM…</b>
          <button type="button" className="am-btn" onClick={onClose}>
            Esc
          </button>
        </div>
        <input
          ref={inputRef}
          type="search"
          className="am-palette__input"
          placeholder="Tìm account, HĐ, việc…"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          onKeyDown={onInputKey}
          aria-label="Từ khóa tìm kiếm"
        />
        <div className="am-palette__list" role="listbox" aria-label="Kết quả">
          {loading ? <p className="am-palette__hint">Đang tìm…</p> : null}
          {!loading && needle.length >= 2 && items.length === 0 ? (
            <div className="am-palette__empty">
              <p>Không tìm thấy</p>
              {canEdit ? (
                <button
                  type="button"
                  className="am-btn am-btn--primary"
                  onClick={() => {
                    onClose();
                    openCreate('client');
                  }}
                >
                  Tạo khách
                </button>
              ) : null}
            </div>
          ) : null}
          {groups.map((block) => (
            <div key={block.group} className="am-palette__group">
              <p className="am-palette__group-label">{GROUP_LABEL[block.group]}</p>
              {block.items.map((item) => {
                flat += 1;
                const index = flat;
                return (
                  <button
                    key={`${item.group}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={`am-palette__row${index === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => openItem(item)}
                  >
                    <span>{item.title}</span>
                    <span className="am-palette__meta">{item.subtitle ?? GROUP_LABEL[item.group]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="am-palette__hint">↵ Mở · Esc đóng · ↑↓ điều hướng</p>
      </div>
    </div>
  );
}

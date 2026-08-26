'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formClasses } from './form-utils';

export type FormComboboxOption = { value: string; label: string };

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function norm(s: string): string {
  return stripDiacritics(s.trim().toLowerCase());
}

function matchesQuery(query: string, opt: FormComboboxOption): boolean {
  const q = norm(query);
  if (!q) return true;
  return norm(opt.label).includes(q) || norm(opt.value).includes(q);
}

function resolveValue(raw: string, options: FormComboboxOption[], allowCustom: boolean): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const exact = options.find((o) => o.value === trimmed || norm(o.label) === norm(trimmed));
  if (exact) return exact.value;
  return allowCustom ? trimmed : '';
}

function labelForValue(value: string, options: FormComboboxOption[]): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

export type FormComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: FormComboboxOption[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  allowCustom?: boolean;
  emptyMessage?: string;
  showCode?: boolean;
};

export function FormCombobox({
  value,
  onChange,
  options,
  disabled,
  loading,
  placeholder = 'Gõ để tìm hoặc nhập…',
  allowCustom = true,
  emptyMessage = 'Không có kết quả — Enter để dùng giá trị đã gõ',
  showCode = true,
}: FormComboboxProps) {
  const id = useId();
  const listId = `${id}-listbox`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const displayLabel = useMemo(() => labelForValue(value, options), [value, options]);

  useEffect(() => {
    if (!open) setQuery(displayLabel);
  }, [displayLabel, open]);

  const filtered = useMemo(() => options.filter((o) => matchesQuery(query, o)), [options, query]);

  function commit(raw: string) {
    const next = resolveValue(raw, options, allowCustom);
    onChange(next);
    setQuery(labelForValue(next, options));
  }

  function pickOption(opt: FormComboboxOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  }

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="form-combobox" ref={wrapRef}>
      <input
        className={formClasses('form-input', 'form-combobox__input')}
        value={query}
        disabled={disabled || loading}
        placeholder={loading ? 'Đang tải…' : placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[activeIndex]) pickOption(filtered[activeIndex]);
            else {
              commit(query);
              setOpen(false);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery(displayLabel);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              commit(query);
              setOpen(false);
            }
          }, 120);
        }}
      />
      {open && !disabled && !loading ? (
        <ul id={listId} className="form-combobox__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="form-combobox__empty">{emptyMessage}</li>
          ) : (
            filtered.slice(0, 80).map((opt, idx) => (
              <li
                key={`${opt.value}-${opt.label}`}
                role="option"
                aria-selected={value === opt.value}
                className={[
                  'form-combobox__option',
                  idx === activeIndex ? 'is-active' : '',
                  value === opt.value ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickOption(opt)}
              >
                <span className="form-combobox__label">{opt.label}</span>
                {showCode && opt.value !== opt.label ? (
                  <span className="form-combobox__code mono">{opt.value}</span>
                ) : null}
              </li>
            ))
          )}
          {filtered.length > 80 ? (
            <li className="form-combobox__empty">Gõ thêm để thu hẹp ({filtered.length} kết quả)</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

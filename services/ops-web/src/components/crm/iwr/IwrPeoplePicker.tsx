'use client';

import { useEffect, useState } from 'react';
import { fetchIwrDirectory, type IwrStaffNode } from '@/lib/crm/iwr-api';
import { iwrAvatarTone, iwrInitials } from './iwr-format';

export type IwrPersonChip = { id: number; name: string };

/** First editable open of a draft hides the auto-assigned To; later opens keep a user-picked To. */
export function iwrInitialToChip(
  reportId: string,
  toRecipient: { staff_id: number; staff_name?: string | null } | undefined,
  readOnly: boolean,
): IwrPersonChip | null {
  if (!toRecipient) return null;
  const chip = { id: toRecipient.staff_id, name: toRecipient.staff_name ?? `#${toRecipient.staff_id}` };
  if (readOnly) return chip;
  if (typeof window === 'undefined') return null;
  const key = `iwr-to-cleared:${reportId}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    return null;
  }
  return chip;
}

type IwrPeoplePickerProps = {
  token: string;
  purpose: 'to' | 'cc' | 'bcc';
  label: string;
  placeholder: string;
  selected: IwrPersonChip[];
  onChange: (next: IwrPersonChip[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  hint?: string;
  testId?: string;
  className?: string;
};

export function IwrPeoplePicker({
  token,
  purpose,
  label,
  placeholder,
  selected,
  onChange,
  disabled,
  multiple = true,
  hint,
  testId,
  className,
}: IwrPeoplePickerProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<IwrStaffNode[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (disabled || q.length < 1) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, q, purpose)
        .then((out) => {
          const picked = new Set(selected.map((s) => s.id));
          setHits((out.items ?? []).filter((p) => !picked.has(p.id)));
        })
        .catch(() => setHits([]));
    }, 160);
    return () => window.clearTimeout(t);
  }, [token, purpose, query, selected, disabled]);

  function pick(person: IwrStaffNode) {
    const chip = { id: person.id, name: person.name };
    onChange(multiple ? [...selected.filter((s) => s.id !== person.id), chip] : [chip]);
    setQuery('');
  }

  function remove(id: number) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div className={`iwr-mail__cell${className ? ` ${className}` : ''}`} data-testid={testId}>
      <div className="iwr-mail__k">{label}</div>
      <div className="iwr-mail__people">
        {selected.map((person) => (
          <span key={person.id} className="iwr-mail__chip">
            <span className={iwrAvatarTone(person.id)}>{iwrInitials(person.name)}</span>
            <span>
              <strong>{person.name}</strong>
              {hint && !multiple && <div className="iwr-muted">{hint}</div>}
            </span>
            {!disabled && (
              <button
                type="button"
                className="iwr-iconbtn"
                aria-label={`Bỏ ${label} ${person.name}`}
                onClick={() => remove(person.id)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <div className="iwr-mail__search">
            <input
              className="iwr-input"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {hits.length > 0 && query.trim() && (
              <ul className="iwr-mail__hits">
                {hits.map((person) => (
                  <li key={person.id}>
                    <button type="button" onClick={() => pick(person)}>
                      {person.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

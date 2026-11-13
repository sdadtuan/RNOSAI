'use client';

import './portal-date-range.css';

import { useEffect, useState } from 'react';
import {
  DATE_PRESETS,
  formatViDate,
  matchPreset,
  parseViDate,
  presetRange,
  type DatePresetId,
} from '@/lib/portal/portal-date-range.util';

export function PortalDateRange({
  from,
  to,
  onChange,
  ariaFrom = 'Từ ngày (dd/mm/yyyy)',
  ariaTo = 'Đến ngày (dd/mm/yyyy)',
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  ariaFrom?: string;
  ariaTo?: string;
}) {
  const [fromText, setFromText] = useState(formatViDate(from));
  const [toText, setToText] = useState(formatViDate(to));
  const [fromErr, setFromErr] = useState(false);
  const [toErr, setToErr] = useState(false);
  const active = matchPreset(from, to);

  useEffect(() => {
    setFromText(formatViDate(from));
    setFromErr(false);
  }, [from]);
  useEffect(() => {
    setToText(formatViDate(to));
    setToErr(false);
  }, [to]);

  function commit(which: 'from' | 'to', raw: string) {
    const parsed = parseViDate(raw);
    if (parsed === null) {
      if (which === 'from') setFromErr(true);
      else setToErr(true);
      return;
    }
    if (which === 'from') {
      setFromErr(false);
      onChange({ from: parsed, to });
    } else {
      setToErr(false);
      onChange({ from, to: parsed });
    }
  }

  function applyPreset(id: Exclude<DatePresetId, ''>) {
    onChange(presetRange(id));
  }

  return (
    <div className="portal-daterange">
      <div className="portal-daterange__presets" role="group" aria-label="Khoảng ngày nhanh">
        {DATE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? 'portal-daterange__preset is-on' : 'portal-daterange__preset'}
            onClick={() => applyPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="portal-daterange__field">
        Từ ngày
        <input
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label={ariaFrom}
          value={fromText}
          onChange={(event) => {
            setFromText(event.target.value);
            setFromErr(false);
          }}
          onBlur={() => commit('from', fromText)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit('from', fromText);
          }}
          className={fromErr ? 'is-invalid' : undefined}
        />
      </label>
      <label className="portal-daterange__field">
        Đến ngày
        <input
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label={ariaTo}
          value={toText}
          onChange={(event) => {
            setToText(event.target.value);
            setToErr(false);
          }}
          onBlur={() => commit('to', toText)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit('to', toText);
          }}
          className={toErr ? 'is-invalid' : undefined}
        />
      </label>
    </div>
  );
}

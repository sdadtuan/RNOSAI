'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

type Props = {
  row: KpiHubDictionaryRow;
  onClose?: () => void;
};

export function KpiHubDictRowMenu({ row, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  return (
    <div className="kpi-hub-row-menu" ref={ref}>
      <button
        type="button"
        className="kpi-hub-row-menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋮
      </button>
      {open ? (
        <div className="kpi-hub-row-menu__panel" role="menu">
          <Link
            href={`/crm/kpi-hub/dictionary/${row.id}/edit`}
            className="kpi-hub-row-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Chỉnh sửa
          </Link>
          <button
            type="button"
            className="kpi-hub-row-menu__item"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            Nhân bản
          </button>
          <button
            type="button"
            className="kpi-hub-row-menu__item"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            Kiểm tra công thức
          </button>
        </div>
      ) : null}
    </div>
  );
}

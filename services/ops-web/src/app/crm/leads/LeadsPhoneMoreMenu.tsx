'use client';

import { useEffect, useRef, useState } from 'react';
import { CrmLeadsImportExport } from '@/components/crm/CrmLeadsImportExport';
import { LeadsColumnPicker } from '@/components/crm/LeadsColumnPicker';
import type { LeadsColumnId } from '@/lib/crm/leads-columns';

type LeadsPhoneMoreMenuProps = {
  token: string | null;
  query: string;
  selectedIds: number[];
  canImport: boolean;
  visibleColumns: Set<LeadsColumnId>;
  showScores: boolean;
  showLeadKindTags: boolean;
  onColumnsChange: (next: Set<LeadsColumnId>) => void;
  onImported: () => void;
  onError: (message: string) => void;
};

export function LeadsPhoneMoreMenu({
  token,
  query,
  selectedIds,
  canImport,
  visibleColumns,
  showScores,
  showLeadKindTags,
  onColumnsChange,
  onImported,
  onError,
}: LeadsPhoneMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="leads-phone-more" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm crm-leads-phone-only"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Thêm
      </button>
      {open ? (
        <div className="leads-phone-more__menu" role="menu">
          <LeadsColumnPicker
            visible={visibleColumns}
            showScores={showScores}
            showLeadKindTags={showLeadKindTags}
            onChange={onColumnsChange}
          />
          {token ? (
            <CrmLeadsImportExport
              layout="menu"
              token={token}
              query={query}
              selectedIds={selectedIds}
              canImport={canImport}
              onImported={onImported}
              onError={onError}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

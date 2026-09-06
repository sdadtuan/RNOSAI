'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useRevopsPage } from './RevOpsShell';
import { RevOpsQuickCreateModal, type RevOpsQuickTileAction } from './RevOpsQuickCreateModal';
import {
  RevOpsAssignModal,
  type RevOpsAssignContext,
} from './modals/RevOpsAssignModal';
import { RevOpsDealModal } from './modals/RevOpsDealModal';
import {
  RevOpsDuplicateModal,
  type RevOpsDuplicateContext,
} from './modals/RevOpsDuplicateModal';
import { RevOpsLeadModal } from './modals/RevOpsLeadModal';
import { RevOpsQuoteModal } from './modals/RevOpsQuoteModal';

export type RevopsModalsApi = {
  openQuickCreate: () => void;
  openLead: () => void;
  openAssign: (ctx?: RevOpsAssignContext) => void;
  openDuplicate: (ctx: RevOpsDuplicateContext) => void;
  openDeal: (leadId?: number) => void;
  openQuote: (leadId?: number) => void;
};

const RevopsModalsContext = createContext<RevopsModalsApi | null>(null);

export function useRevopsModals(): RevopsModalsApi {
  const ctx = useContext(RevopsModalsContext);
  if (!ctx) throw new Error('useRevopsModals must be used inside RevOpsModalsProvider');
  return ctx;
}

export function RevOpsModalsProvider({ children }: { children: ReactNode }) {
  const { token } = useRevopsPage();
  const searchParams = useSearchParams();

  const [quickOpen, setQuickOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCtx, setAssignCtx] = useState<RevOpsAssignContext | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateCtx, setDuplicateCtx] = useState<RevOpsDuplicateContext | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [dealLeadId, setDealLeadId] = useState<number | undefined>();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteLeadId, setQuoteLeadId] = useState<number | undefined>();

  const duplicateFromQuery = useMemo(() => {
    const leadId = Number(searchParams.get('duplicate_lead') ?? searchParams.get('lead_id') ?? '');
    const duplicateOfId = Number(searchParams.get('duplicate_of') ?? '');
    if (!Number.isFinite(leadId) || leadId <= 0) return null;
    if (!Number.isFinite(duplicateOfId) || duplicateOfId <= 0) return null;
    return {
      leadId,
      duplicateOfId,
    } satisfies RevOpsDuplicateContext;
  }, [searchParams]);

  useEffect(() => {
    if (duplicateFromQuery) {
      setDuplicateCtx(duplicateFromQuery);
      setDuplicateOpen(true);
    }
  }, [duplicateFromQuery]);

  const api = useMemo<RevopsModalsApi>(
    () => ({
      openQuickCreate: () => setQuickOpen(true),
      openLead: () => setLeadOpen(true),
      openAssign: (ctx) => {
        setAssignCtx(ctx ?? null);
        setAssignOpen(true);
      },
      openDuplicate: (ctx) => {
        setDuplicateCtx(ctx);
        setDuplicateOpen(true);
      },
      openDeal: (leadId) => {
        setDealLeadId(leadId);
        setDealOpen(true);
      },
      openQuote: (leadId) => {
        setQuoteLeadId(leadId);
        setQuoteOpen(true);
      },
    }),
    [],
  );

  const onQuickPick = useCallback((action: RevOpsQuickTileAction) => {
    if (action === 'lead') setLeadOpen(true);
    if (action === 'deal') setDealOpen(true);
    if (action === 'assign') {
      setAssignCtx(null);
      setAssignOpen(true);
    }
  }, []);

  return (
    <RevopsModalsContext.Provider value={api}>
      {children}
      <RevOpsQuickCreateModal open={quickOpen} onClose={() => setQuickOpen(false)} onPick={onQuickPick} />
      <RevOpsLeadModal
        open={leadOpen}
        token={token}
        onClose={() => setLeadOpen(false)}
        onCreated={(id) => {
          setDealLeadId(id);
        }}
      />
      <RevOpsAssignModal
        open={assignOpen}
        token={token}
        context={assignCtx}
        onClose={() => setAssignOpen(false)}
      />
      <RevOpsDuplicateModal
        open={duplicateOpen}
        token={token}
        context={duplicateCtx ?? duplicateFromQuery}
        onClose={() => {
          setDuplicateOpen(false);
          setDuplicateCtx(null);
        }}
      />
      <RevOpsDealModal
        open={dealOpen}
        token={token}
        presetLeadId={dealLeadId}
        onClose={() => setDealOpen(false)}
      />
      <RevOpsQuoteModal
        open={quoteOpen}
        token={token}
        presetLeadId={quoteLeadId}
        onClose={() => setQuoteOpen(false)}
      />
    </RevopsModalsContext.Provider>
  );
}

export function RevOpsQuickCreateButton({ label = '＋ Tạo nhanh' }: { label?: string }) {
  const { openQuickCreate } = useRevopsModals();
  return (
    <button type="button" className="revops-btn revops-btn--primary" onClick={openQuickCreate}>
      {label}
    </button>
  );
}

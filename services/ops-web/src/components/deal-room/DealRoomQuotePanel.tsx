'use client';

import Link from 'next/link';
import { useState } from 'react';
import { L1GateChecklist, type L1GateChecklistItem } from '@/components/deal-room/L1GateChecklist';
import { exportLeadDealRoomPack } from '@/lib/api';

interface Props {
  leadId: number;
  token: string;
  canCreate: boolean;
  blockReason: string;
  proposalsHref: string;
  canExportPack: boolean;
  exportBlockReason?: string;
  proposalId?: number | null;
  l1Checklist?: L1GateChecklistItem[];
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export function DealRoomQuotePanel({
  leadId,
  token,
  canCreate,
  blockReason,
  proposalsHref,
  canExportPack,
  exportBlockReason,
  proposalId,
  l1Checklist = [],
  onMessage,
  onError,
}: Props) {
  const [exportBusy, setExportBusy] = useState(false);

  async function handleExportPack() {
    if (!canExportPack || exportBusy) return;
    setExportBusy(true);
    onError?.('');
    try {
      const { blob, filename } = await exportLeadDealRoomPack(token, leadId, {
        proposal_id: proposalId ?? undefined,
        include_timeline: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onMessage?.(`Đã tải Pack PDF: ${filename}`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Export Pack PDF thất bại');
    } finally {
      setExportBusy(false);
    }
  }

  const packTitle =
    exportBlockReason ||
    (!canExportPack ? 'Hoàn thành G4 R5 và bật PTT_DEAL_ROOM_PACK_PDF để export' : 'Tải Plan+Quote Pack PDF');

  const createTitle = canCreate
    ? 'Mở Quote Builder với context lead'
    : blockReason || 'Hoàn thành checklist G4 trước khi tạo báo giá';

  return (
    <section className="deal-room-panel" aria-label="Quote">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">Báo giá</h3>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Gói Basic / Standard / Premium — catalog DV. Pack PDF gộp L1 + báo giá 3 gói + timeline 90 ngày.
      </p>

      {!canCreate && l1Checklist.length ? (
        <div style={{ marginTop: '0.75rem' }}>
          <L1GateChecklist items={l1Checklist} />
        </div>
      ) : null}

      {!canCreate && !l1Checklist.length && blockReason ? (
        <ul className="deal-room-checklist deal-room-checklist--block" style={{ marginTop: '0.75rem' }}>
          <li>{blockReason}</li>
        </ul>
      ) : null}

      <div className="deal-room-actions" style={{ marginTop: '1rem' }}>
        <Link
          href={proposalsHref}
          className={`btn btn-sm ${canCreate ? 'btn-primary' : 'btn-secondary'}`}
          aria-disabled={!canCreate}
          title={createTitle}
          style={canCreate ? undefined : { pointerEvents: 'none', opacity: 0.55 }}
        >
          Tạo báo giá →
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={!canExportPack || exportBusy}
          title={packTitle}
          onClick={() => void handleExportPack()}
        >
          {exportBusy ? 'Đang xuất PDF…' : 'Export Pack PDF'}
        </button>
      </div>
    </section>
  );
}

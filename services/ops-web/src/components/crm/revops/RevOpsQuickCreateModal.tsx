'use client';

import { useRouter } from 'next/navigation';
import { RevOpsModalFrame } from './RevOpsModalFrame';

const TILES = [
  {
    id: 'lead',
    icon: '◎',
    title: 'Lead mới',
    sub: 'Tạo lead thủ công hoặc từ nguồn offline',
    action: 'lead' as const,
  },
  {
    id: 'deal',
    icon: '▥',
    title: 'Opportunity mới',
    sub: 'Tạo deal và đưa vào pipeline',
    action: 'deal' as const,
  },
  {
    id: 'account',
    icon: '◌',
    title: 'Account mới',
    sub: 'Tạo khách hàng/doanh nghiệp',
    action: 'account' as const,
  },
  {
    id: 'handover',
    icon: '⇄',
    title: 'Handover',
    sub: 'Khởi tạo hồ sơ bàn giao Sales',
    action: 'handover' as const,
  },
  {
    id: 'kpi',
    icon: '◈',
    title: 'Giao KPI',
    sub: 'Giao target kỳ mới',
    action: 'kpi' as const,
  },
  {
    id: 'assign',
    icon: '⌖',
    title: 'Phân bổ lead',
    sub: 'Assign theo rule hoặc thủ công',
    action: 'assign' as const,
  },
] as const;

export type RevOpsQuickTileAction =
  | 'lead'
  | 'deal'
  | 'assign'
  | 'account'
  | 'handover'
  | 'kpi';

export function RevOpsQuickCreateModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (action: RevOpsQuickTileAction) => void;
}) {
  function onTile(tile: (typeof TILES)[number]) {
    onClose();
    onPick(tile.action);
  }

  return (
    <RevOpsModalFrame open={open} title="Tạo nhanh" onClose={onClose} wide>
      <div className="revops-quick-grid">
        {TILES.map((tile) => (
          <button key={tile.id} type="button" className="revops-quick-tile" onClick={() => onTile(tile)}>
            <b>
              {tile.icon} {tile.title}
            </b>
            <p>{tile.sub}</p>
          </button>
        ))}
      </div>
    </RevOpsModalFrame>
  );
}

import type { StockKind, StockState } from './portal-pos.types';

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

export function availableStock(state: StockState): number {
  return Math.max(0, Math.round(state.on_hand) - Math.round(state.reserved));
}

function qtyOf(qty: number): number {
  const q = Math.round(Number(qty));
  if (!Number.isFinite(q) || q < 0) {
    throw new StockError('invalid_qty');
  }
  return q;
}

/**
 * Pure stock movement. `adjust` sets on_hand to `qty` (absolute).
 * `deduct` ships reserved units (falls back to available if reserve is short).
 */
export function applyStockMovement(state: StockState, kind: StockKind, qty: number): StockState {
  const on_hand = Math.round(state.on_hand) || 0;
  const reserved = Math.max(0, Math.round(state.reserved) || 0);
  const q = qtyOf(qty);
  const next: StockState = { on_hand, reserved };

  switch (kind) {
    case 'import':
    case 'restock':
      next.on_hand = on_hand + q;
      break;
    case 'export': {
      if (availableStock(next) < q) throw new StockError('insufficient_stock');
      next.on_hand = on_hand - q;
      break;
    }
    case 'reserve': {
      if (availableStock(next) < q) throw new StockError('insufficient_stock');
      next.reserved = reserved + q;
      break;
    }
    case 'release':
      next.reserved = Math.max(0, reserved - q);
      break;
    case 'deduct': {
      const fromReserved = Math.min(reserved, q);
      next.reserved = reserved - fromReserved;
      next.on_hand = on_hand - q;
      if (next.on_hand < 0) throw new StockError('insufficient_stock');
      break;
    }
    case 'adjust':
      next.on_hand = q;
      if (next.reserved > next.on_hand) next.reserved = next.on_hand;
      break;
    default:
      throw new StockError('unknown_kind');
  }
  return next;
}

export function isLowStock(state: StockState, threshold: number): boolean {
  const t = Math.max(0, Math.round(threshold) || 0);
  return availableStock(state) <= t;
}

import type { CarrierId, CustomerRisk, OrderStatus, StockAction } from './portal-pos.types';
import { ORDER_STATUSES } from './portal-pos.types';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['packing', 'cancelled'],
  packing: ['awaiting_pickup', 'cancelled'],
  awaiting_pickup: ['shipping', 'cancelled', 'returned'],
  shipping: ['success', 'returned'],
  success: ['returned'],
  returned: [],
  cancelled: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Stock side-effect of a status change:
 * - reserve on confirm
 * - deduct on ship (entering awaiting_pickup, or shipping if skipped)
 * - release reserved on cancel/return before ship
 * - restock on return/cancel after deduct
 */
export function stockActionForTransition(from: OrderStatus, to: OrderStatus): StockAction {
  if (to === 'confirmed' && from === 'new') return 'reserve';

  const reservedStages: OrderStatus[] = ['confirmed', 'packing'];
  const deductedStages: OrderStatus[] = ['awaiting_pickup', 'shipping', 'success'];

  if (to === 'cancelled') {
    if (reservedStages.includes(from)) return 'release';
    if (from === 'awaiting_pickup' || from === 'shipping') return 'restock';
    return null;
  }
  if (to === 'returned') {
    if (deductedStages.includes(from)) return 'restock';
    if (reservedStages.includes(from)) return 'release';
    return null;
  }
  if (to === 'awaiting_pickup' && (from === 'packing' || from === 'confirmed')) return 'deduct';
  if (to === 'shipping' && (from === 'packing' || from === 'confirmed')) return 'deduct';
  return null;
}

export function customerRisk(input: {
  success: number;
  returned: number;
  blacklist?: boolean;
}): CustomerRisk {
  const success = Math.max(0, Math.round(input.success) || 0);
  const returned = Math.max(0, Math.round(input.returned) || 0);
  const total = success + returned;
  const rate = total > 0 ? returned / total : 0;
  if (input.blacklist) {
    return {
      level: 'block',
      return_rate: rate,
      success,
      returned,
      blacklist: true,
      message: 'Khách nằm trong danh sách hạn chế — cân nhắc trước khi chốt đơn.',
    };
  }
  if (total >= 2 && rate >= 0.5) {
    return {
      level: 'warn',
      return_rate: rate,
      success,
      returned,
      blacklist: false,
      message: `Tỷ lệ hoàn cao (${Math.round(rate * 100)}% — ${returned}/${total} đơn).`,
    };
  }
  if (total >= 3 && rate >= 0.3) {
    return {
      level: 'warn',
      return_rate: rate,
      success,
      returned,
      blacklist: false,
      message: `Tỷ lệ hoàn ${Math.round(rate * 100)}% (${returned}/${total} đơn) — lưu ý khi giao COD.`,
    };
  }
  return {
    level: 'ok',
    return_rate: rate,
    success,
    returned,
    blacklist: false,
    message: '',
  };
}

/** Map a GHN webhook / polling status (documented public API) to an order status. */
export function mapGhnStatus(raw: string): OrderStatus | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const table: Record<string, OrderStatus> = {
    ready_to_pick: 'awaiting_pickup',
    picking: 'awaiting_pickup',
    money_collect_picking: 'awaiting_pickup',
    picked: 'shipping',
    storing: 'shipping',
    transporting: 'shipping',
    sorting: 'shipping',
    delivering: 'shipping',
    money_collect_delivering: 'shipping',
    delivery_fail: 'shipping',
    waiting_to_return: 'returned',
    return: 'returned',
    return_transporting: 'returned',
    return_sorting: 'returned',
    returning: 'returned',
    returned: 'returned',
    delivered: 'success',
    money_collect_delivered: 'success',
    cancel: 'cancelled',
    cancelled: 'cancelled',
    exception: 'shipping',
    lost: 'returned',
    damage: 'returned',
  };
  return table[s] ?? null;
}

/**
 * GHTK status ids / Vietnamese labels from public docs.
 * https://docs.giaohangtietkiem.vn/
 */
export function mapGhtkStatus(raw: string | number): OrderStatus | null {
  const s = String(raw ?? '').trim().toLowerCase();
  const num = s.replace(/^stat(us)?[_:]?\s*/, '');
  const table: Record<string, OrderStatus> = {
    '-1': 'cancelled',
    '1': 'awaiting_pickup',
    '2': 'shipping',
    '3': 'success',
    '4': 'shipping',
    '5': 'success',
    '6': 'returned',
    '7': 'shipping',
    '8': 'shipping',
    '9': 'cancelled',
    '10': 'shipping',
    '11': 'shipping',
    '12': 'shipping',
    '13': 'returned',
    '20': 'returned',
    '21': 'returned',
    'đã lấy hàng': 'shipping',
    'dang lay hang': 'awaiting_pickup',
    'đang giao hàng': 'shipping',
    'đang giao hang': 'shipping',
    'đã giao hàng': 'success',
    'da giao hang': 'success',
    'đã đối soát': 'success',
    'hủy đơn hàng': 'cancelled',
    'huy don hang': 'cancelled',
    'đã hủy': 'cancelled',
    'đang trả hàng': 'returned',
    'đã trả hàng': 'returned',
    'hoàn hàng': 'returned',
  };
  return table[num] ?? table[s] ?? null;
}

/** Viettel Post order status codes from partner public docs. */
export function mapVtpStatus(raw: string | number): OrderStatus | null {
  const s = String(raw ?? '').trim();
  const table: Record<string, OrderStatus> = {
    '-100': 'cancelled',
    '100': 'awaiting_pickup',
    '101': 'awaiting_pickup',
    '102': 'awaiting_pickup',
    '103': 'awaiting_pickup',
    '104': 'shipping',
    '200': 'shipping',
    '201': 'shipping',
    '202': 'shipping',
    '300': 'shipping',
    '400': 'shipping',
    '500': 'shipping',
    '501': 'success',
    '502': 'shipping',
    '503': 'returned',
    '504': 'returned',
    '505': 'returned',
    '506': 'cancelled',
    '507': 'returned',
  };
  return table[s] ?? null;
}

export function mapCarrierStatus(carrier: CarrierId, raw: string | number): OrderStatus | null {
  if (carrier === 'ghn') return mapGhnStatus(String(raw));
  if (carrier === 'ghtk') return mapGhtkStatus(raw);
  if (carrier === 'vtp') return mapVtpStatus(raw);
  return null;
}

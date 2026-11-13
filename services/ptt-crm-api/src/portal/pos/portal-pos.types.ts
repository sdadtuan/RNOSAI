export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'packing',
  'awaiting_pickup',
  'shipping',
  'success',
  'returned',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Mới',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  awaiting_pickup: 'Chờ lấy hàng',
  shipping: 'Đang giao',
  success: 'Thành công',
  returned: 'Hoàn',
  cancelled: 'Hủy',
};

export const ORDER_SOURCES = ['inbox', 'comment', 'manual', 'ad', 'import'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const STOCK_KINDS = [
  'import',
  'export',
  'reserve',
  'release',
  'deduct',
  'restock',
  'adjust',
] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

export const CARRIERS = ['ghn', 'ghtk', 'vtp'] as const;
export type CarrierId = (typeof CARRIERS)[number];

export const CARRIER_LABELS: Record<CarrierId, string> = {
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
  vtp: 'Viettel Post',
};

export type StockState = { on_hand: number; reserved: number };

export type OrderLineInput = { qty: number; price_vnd: number };

export type OrderTotalsInput = {
  items: OrderLineInput[];
  discount_vnd?: number;
  shipping_fee_vnd?: number;
  deposit_vnd?: number;
};

export type OrderTotals = {
  subtotal_vnd: number;
  discount_vnd: number;
  shipping_fee_vnd: number;
  deposit_vnd: number;
  total_vnd: number;
  cod_vnd: number;
};

export type StockAction = 'reserve' | 'release' | 'deduct' | 'restock' | null;

export type CustomerRiskLevel = 'ok' | 'warn' | 'block';

export type CustomerRisk = {
  level: CustomerRiskLevel;
  return_rate: number;
  success: number;
  returned: number;
  blacklist: boolean;
  message: string;
};

import { API_BASE } from '@/lib/api';

async function posFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: T & { error?: string; message?: string } = {} as T & { error?: string; message?: string };
  if (text) {
    try {
      body = JSON.parse(text) as T & { error?: string; message?: string };
    } catch {
      throw new Error('Phản hồi không hợp lệ');
    }
  }
  if (!res.ok) {
    const err = body.error || body.message || `Lỗi ${res.status}`;
    const map: Record<string, string> = {
      items_required: 'Chọn ít nhất một sản phẩm.',
      phone_required: 'Nhập số điện thoại khách.',
      insufficient_stock: 'Không đủ tồn kho.',
      invalid_transition: 'Không thể chuyển sang trạng thái này.',
      order_locked: 'Đơn đã xác nhận, không sửa được sản phẩm.',
      approver_only: 'Chỉ chủ sở hữu hoặc người duyệt mới làm được.',
      not_assignee: 'Đơn này không được giao cho bạn.',
      name_required: 'Nhập tên sản phẩm.',
    };
    throw new Error(map[err] || body.message || err);
  }
  return body;
}

export const POS_STATUSES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'new', label: 'Mới' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'packing', label: 'Đang đóng gói' },
  { id: 'awaiting_pickup', label: 'Chờ lấy hàng' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'success', label: 'Thành công' },
  { id: 'returned', label: 'Hoàn' },
  { id: 'cancelled', label: 'Hủy' },
] as const;

export const POS_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  POS_STATUSES.filter((s) => s.id !== 'all').map((s) => [s.id, s.label]),
);

export const POS_SOURCE_LABEL: Record<string, string> = {
  inbox: 'Hộp thư',
  comment: 'Bình luận',
  manual: 'Tạo tay',
  ad: 'Quảng cáo',
  import: 'Import',
};

export const POS_CARRIER_LABEL: Record<string, string> = {
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
  vtp: 'Viettel Post',
};

export function vnd(value: number | null | undefined): string {
  const n = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}

export type PosVariant = {
  id: string; sku: string; barcode: string; color: string; size: string;
  price_vnd: number | null; compare_at_vnd: number | null; cost_vnd: number | null;
  weight_gram: number | null; image_url: string; active: boolean;
  on_hand: number; reserved: number; available: number; low_stock: boolean;
};

export type PosProduct = {
  id: string; page_id: string; name: string; detail: string; image_url: string;
  sku: string; barcode: string; category_id: string | null; category_name: string;
  price_vnd: number | null; compare_at_vnd: number | null; cost_vnd: number | null;
  weight_gram: number | null; is_combo: boolean; low_stock_threshold: number;
  active: boolean; on_hand: number; reserved: number; available: number; low_stock: boolean;
  variants: PosVariant[];
};

export type PosOrderItem = {
  id?: string; product_id?: string | null; variant_id?: string | null;
  name: string; sku: string; color: string; size: string; qty: number;
  price_vnd: number; cost_vnd?: number; image_url?: string; weight_gram?: number;
};

export type PosOrder = {
  id: string; code: string; status: string; page_id: string; case_id: string | null;
  comment_id: string; customer_id: string | null; assignee_user_id: string | null;
  assignee_email: string; source: string; customer_name: string; phone: string;
  email: string; address: string; province: string; district: string; ward: string;
  subtotal_vnd: number; discount_vnd: number; shipping_fee_vnd: number; deposit_vnd: number;
  total_vnd: number; cod_vnd: number; notes: string; customer_notes: string;
  ad_id: string; post_id: string; stock_state: string;
  confirmed_at: string; shipped_at: string; delivered_at: string;
  cancelled_at: string; returned_at: string; created_at: string; updated_at: string;
  items: PosOrderItem[];
  events: Array<{ id: string; from_status: string; to_status: string; note: string; actor_email: string; created_at: string }>;
  shipments: Array<{
    id: string; carrier: string; service_code: string; service_name: string;
    tracking_code: string; fee_vnd: number; status: string; raw_status: string;
    label_url: string; test_mode: boolean; cancelled_at: string; created_at: string;
  }>;
};

export type PosRisk = { level: 'ok' | 'warn' | 'block'; return_rate: number; success: number; returned: number; blacklist: boolean; message: string };

export function posGet<T>(token: string, path: string) {
  return posFetch<T>(token, path);
}
export function posPost<T>(token: string, path: string, body?: unknown) {
  return posFetch<T>(token, path, { method: 'POST', body: body == null ? undefined : JSON.stringify(body) });
}
export function posPatch<T>(token: string, path: string, body?: unknown) {
  return posFetch<T>(token, path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
}
export function posDelete<T>(token: string, path: string) {
  return posFetch<T>(token, path, { method: 'DELETE' });
}

export async function posUploadCsv(token: string, path: string, file: File, extra?: Record<string, string>) {
  const body = new FormData();
  body.set('file', file);
  if (extra) for (const [k, v] of Object.entries(extra)) body.set(k, v);
  return posFetch<unknown>(token, path, { method: 'POST', body });
}

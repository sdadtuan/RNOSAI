import { mapGhnStatus } from '../portal-pos-status.util';
import {
  defaultFee,
  postJson,
  shouldCallLiveCarrier,
  simulatedTracking,
  type CarrierAdapter,
  type CarrierAccount,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type JsonFetch,
  type QuoteInput,
  type QuoteResult,
  type CancelResult,
} from './carrier-adapter';

/** Public GHN docs: https://developer.ghn.vn/vi/docs — production host, never called unless LIVE. */
export const GHN_PROD = 'https://online-gateway.ghn.vn';
export const GHN_SANDBOX = 'https://dev-online-gateway.ghn.vn';

function headers(account: CarrierAccount): Record<string, string> {
  const h: Record<string, string> = { Token: account.token };
  if (account.shop_id) h.ShopId = account.shop_id;
  return h;
}

function host(account: CarrierAccount): string {
  return account.test_mode ? GHN_SANDBOX : GHN_PROD;
}

/** Documented GHN fee + create payloads used by unit tests and the simulator. */
export function ghnFeeResponse(fee: number) {
  return { code: 200, message: 'Success', data: { total: fee, service_fee: fee, insurance_fee: 0 } };
}

export function ghnCreateResponse(tracking: string, fee: number) {
  return {
    code: 200,
    message: 'Success',
    data: {
      order_code: tracking,
      sort_code: 'A-00-00',
      trans_type: 'truck',
      total_fee: fee,
      expected_delivery_time: new Date(Date.now() + 2 * 86400000).toISOString(),
    },
  };
}

export function ghnCancelResponse() {
  return { code: 200, message: 'Success', data: { result: true } };
}

export const ghnAdapter: CarrierAdapter = {
  id: 'ghn',
  mapStatus: (raw) => mapGhnStatus(String(raw)),

  labelUrl(account, tracking) {
    const base = host(account);
    return `${base}/a5/public-api/printA5?token=${encodeURIComponent(account.token ? 'redacted' : 'test')}&order_code=${encodeURIComponent(tracking)}`;
  },

  async quote(account, input: QuoteInput, fetchFn?: JsonFetch): Promise<QuoteResult[]> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/shiip/public-api/v2/shipping-order/fee`, headers(account), {
        service_type_id: 2,
        insurance_value: input.value_vnd,
        weight: input.weight_gram,
        to_name: 'Khach',
      });
      const data = (res.json as { data?: { total?: number } } | null)?.data;
      const live = Number(data?.total);
      if (res.ok && Number.isFinite(live)) {
        return [{ service_code: '2', service_name: 'GHN Nhanh', fee_vnd: Math.round(live) }];
      }
      throw new Error('ghn_quote_failed');
    }
    return [
      { service_code: '2', service_name: 'GHN Nhanh', fee_vnd: fee, eta: '2-3 ngày' },
      { service_code: '5', service_name: 'GHN Tiết kiệm', fee_vnd: Math.max(12000, fee - 4000), eta: '3-5 ngày' },
    ];
  },

  async create(account, input: CreateShipmentInput, fetchFn?: JsonFetch): Promise<CreateShipmentResult> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(
        fetchFn,
        `${host(account)}/shiip/public-api/v2/shipping-order/create`,
        headers(account),
        {
          payment_type_id: 2,
          required_note: 'CHOXEMHANGKHONGTHU',
          client_order_code: input.client_order_code,
          to_name: input.customer_name,
          to_phone: input.customer_phone,
          to_address: input.customer_address,
          cod_amount: input.cod_vnd,
          weight: input.weight_gram,
          service_type_id: Number(input.service_code) || 2,
          items: input.items.map((item) => ({
            name: item.name,
            quantity: item.qty,
            price: item.price_vnd,
          })),
        },
      );
      const data = (res.json as { data?: { order_code?: string; total_fee?: number } } | null)?.data;
      if (!res.ok || !data?.order_code) throw new Error('ghn_create_failed');
      return {
        tracking_code: String(data.order_code),
        fee_vnd: Math.round(Number(data.total_fee) || fee),
        label_url: ghnAdapter.labelUrl(account, String(data.order_code)),
        raw_status: 'ready_to_pick',
        raw: res.json,
        simulated: false,
      };
    }
    const tracking = simulatedTracking('ghn', input.client_order_code);
    const raw = ghnCreateResponse(tracking, fee);
    return {
      tracking_code: tracking,
      fee_vnd: fee,
      label_url: ghnAdapter.labelUrl(account, tracking),
      raw_status: 'ready_to_pick',
      raw,
      simulated: true,
    };
  },

  async cancel(account, trackingCode, fetchFn?: JsonFetch): Promise<CancelResult> {
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(
        fetchFn,
        `${host(account)}/shiip/public-api/v2/switch-status/cancel`,
        headers(account),
        { order_codes: [trackingCode] },
      );
      return { ok: res.ok, raw: res.json, simulated: false };
    }
    return { ok: true, raw: ghnCancelResponse(), simulated: true };
  },
};

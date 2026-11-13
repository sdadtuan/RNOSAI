import { mapGhtkStatus } from '../portal-pos-status.util';
import {
  defaultFee,
  postJson,
  shouldCallLiveCarrier,
  simulatedTracking,
  type CarrierAdapter,
  type CarrierAccount,
  type CreateShipmentInput,
  type JsonFetch,
  type QuoteInput,
  type QuoteResult,
  type CreateShipmentResult,
  type CancelResult,
} from './carrier-adapter';

/** Public GHTK docs: https://docs.giaohangtietkiem.vn / https://pro-docs.ghtk.vn/ */
export const GHTK_PROD = 'https://services.giaohangtietkiem.vn';
export const GHTK_SANDBOX = 'https://dev.giaohangtietkiem.vn';

function headers(account: CarrierAccount): Record<string, string> {
  return { Token: account.token };
}

function host(account: CarrierAccount): string {
  return account.test_mode ? GHTK_SANDBOX : GHTK_PROD;
}

export function ghtkFeeResponse(fee: number) {
  return { success: true, fee: { fee, insurance_fee: 0, ship_fee_only: fee } };
}

export function ghtkCreateResponse(tracking: string, fee: number) {
  return {
    success: true,
    message: 'OK',
    order: {
      partner_id: 'TEST',
      label: tracking,
      area: 1,
      fee,
      insurance_fee: 0,
      estimated_pick_time: 'Sáng mai',
      estimated_deliver_time: '2-3 ngày',
      status_id: 1,
    },
  };
}

export const ghtkAdapter: CarrierAdapter = {
  id: 'ghtk',
  mapStatus: (raw) => mapGhtkStatus(raw),
  labelUrl(_account, tracking) {
    return `https://services.giaohangtietkiem.vn/services/label/${encodeURIComponent(tracking)}`;
  },

  async quote(account, input: QuoteInput, fetchFn?: JsonFetch): Promise<QuoteResult[]> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/services/shipment/fee`, headers(account), {
        pick_province: input.from_province,
        pick_district: input.from_district,
        province: input.to_province,
        district: input.to_district,
        weight: input.weight_gram,
        value: input.value_vnd,
      });
      const live = Number((res.json as { fee?: { fee?: number } } | null)?.fee?.fee);
      if (!res.ok || !Number.isFinite(live)) throw new Error('ghtk_quote_failed');
      return [{ service_code: 'road', service_name: 'GHTK Bộ', fee_vnd: Math.round(live) }];
    }
    return [
      { service_code: 'road', service_name: 'GHTK Bộ', fee_vnd: fee, eta: '2-4 ngày' },
      { service_code: 'fly', service_name: 'GHTK Bay', fee_vnd: fee + 8000, eta: '1-2 ngày' },
    ];
  },

  async create(account, input: CreateShipmentInput, fetchFn?: JsonFetch): Promise<CreateShipmentResult> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/services/shipment/order`, headers(account), {
        products: input.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          weight: (item.weight_gram || 200) / 1000,
        })),
        order: {
          id: input.client_order_code,
          pick_name: 'Shop',
          pick_money: input.cod_vnd,
          is_freeship: '1',
          name: input.customer_name,
          address: input.customer_address,
          province: input.to_province,
          district: input.to_district,
          ward: input.to_ward,
          tel: input.customer_phone,
          email: '',
          note: input.note,
          value: input.value_vnd,
          transport: input.service_code || 'road',
        },
      });
      const order = (res.json as { success?: boolean; order?: { label?: string; fee?: number } } | null)?.order;
      if (!order?.label) throw new Error('ghtk_create_failed');
      return {
        tracking_code: String(order.label),
        fee_vnd: Math.round(Number(order.fee) || fee),
        label_url: ghtkAdapter.labelUrl(account, String(order.label)),
        raw_status: '1',
        raw: res.json,
        simulated: false,
      };
    }
    const tracking = simulatedTracking('ghtk', input.client_order_code);
    const raw = ghtkCreateResponse(tracking, fee);
    return {
      tracking_code: tracking,
      fee_vnd: fee,
      label_url: ghtkAdapter.labelUrl(account, tracking),
      raw_status: '1',
      raw,
      simulated: true,
    };
  },

  async cancel(account, trackingCode, fetchFn?: JsonFetch): Promise<CancelResult> {
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(
        fetchFn,
        `${host(account)}/services/shipment/cancel/${encodeURIComponent(trackingCode)}`,
        headers(account),
        {},
      );
      return { ok: res.ok, raw: res.json, simulated: false };
    }
    return { ok: true, raw: { success: true }, simulated: true };
  },
};

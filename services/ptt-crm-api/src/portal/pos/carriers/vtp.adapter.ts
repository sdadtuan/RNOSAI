import { mapVtpStatus } from '../portal-pos-status.util';
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

/** Public Viettel Post docs: https://partner2.viettelpost.vn/document */
export const VTP_PROD = 'https://partner.viettelpost.vn';
export const VTP_SANDBOX = 'https://partnerdev.viettelpost.vn';

function headers(account: CarrierAccount): Record<string, string> {
  return { Token: account.token };
}

function host(account: CarrierAccount): string {
  return account.test_mode ? VTP_SANDBOX : VTP_PROD;
}

export function vtpFeeResponse(fee: number) {
  return { status: 200, error: false, message: 'OK', data: { MONEY_TOTAL: fee, MONEY_TOTAL_FEE: fee } };
}

export function vtpCreateResponse(tracking: string, fee: number, cod: number) {
  return {
    status: 200,
    error: false,
    message: 'OK',
    data: {
      ORDER_NUMBER: tracking,
      MONEY_TOTAL: fee,
      MONEY_COLLECTION: cod,
      MONEY_TOTAL_FEE: fee,
    },
  };
}

export const vtpAdapter: CarrierAdapter = {
  id: 'vtp',
  mapStatus: (raw) => mapVtpStatus(raw),
  labelUrl(_account, tracking) {
    return `https://partner.viettelpost.vn/v2/order/printing/${encodeURIComponent(tracking)}`;
  },

  async quote(account, input: QuoteInput, fetchFn?: JsonFetch): Promise<QuoteResult[]> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/v2/order/getPrice`, headers(account), {
        PRODUCT_WEIGHT: input.weight_gram,
        PRODUCT_PRICE: input.value_vnd,
        MONEY_COLLECTION: input.value_vnd,
        ORDER_SERVICE: input.service_code || 'VCN',
      });
      const live = Number((res.json as { data?: { MONEY_TOTAL?: number } } | null)?.data?.MONEY_TOTAL);
      if (!res.ok || !Number.isFinite(live)) throw new Error('vtp_quote_failed');
      return [{ service_code: input.service_code || 'VCN', service_name: 'VTP Nhanh', fee_vnd: Math.round(live) }];
    }
    return [
      { service_code: 'VCN', service_name: 'VTP Nhanh', fee_vnd: fee, eta: '1-3 ngày' },
      { service_code: 'VHT', service_name: 'VTP Tiết kiệm', fee_vnd: Math.max(12000, fee - 3000), eta: '3-5 ngày' },
    ];
  },

  async create(account, input: CreateShipmentInput, fetchFn?: JsonFetch): Promise<CreateShipmentResult> {
    const fee = defaultFee(input);
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/v2/order/createOrder`, headers(account), {
        ORDER_NUMBER: input.client_order_code,
        SENDER_FULLNAME: 'Shop',
        RECEIVER_FULLNAME: input.customer_name,
        RECEIVER_ADDRESS: input.customer_address,
        RECEIVER_PHONE: input.customer_phone,
        PRODUCT_WEIGHT: input.weight_gram,
        PRODUCT_PRICE: input.value_vnd,
        MONEY_COLLECTION: input.cod_vnd,
        ORDER_SERVICE: input.service_code || 'VCN',
        PRODUCT_NAME: input.items.map((item) => item.name).join(', ').slice(0, 200),
      });
      const data = (res.json as { data?: { ORDER_NUMBER?: string; MONEY_TOTAL?: number } } | null)?.data;
      if (!data?.ORDER_NUMBER) throw new Error('vtp_create_failed');
      return {
        tracking_code: String(data.ORDER_NUMBER),
        fee_vnd: Math.round(Number(data.MONEY_TOTAL) || fee),
        label_url: vtpAdapter.labelUrl(account, String(data.ORDER_NUMBER)),
        raw_status: '100',
        raw: res.json,
        simulated: false,
      };
    }
    const tracking = simulatedTracking('vtp', input.client_order_code);
    const raw = vtpCreateResponse(tracking, fee, input.cod_vnd);
    return {
      tracking_code: tracking,
      fee_vnd: fee,
      label_url: vtpAdapter.labelUrl(account, tracking),
      raw_status: '100',
      raw,
      simulated: true,
    };
  },

  async cancel(account, trackingCode, fetchFn?: JsonFetch): Promise<CancelResult> {
    if (fetchFn && shouldCallLiveCarrier(account)) {
      const res = await postJson(fetchFn, `${host(account)}/v2/order/cancel`, headers(account), {
        ORDER_NUMBER: trackingCode,
        NOTE: 'Huy don TEST',
      });
      return { ok: res.ok, raw: res.json, simulated: false };
    }
    return { ok: true, raw: { status: 200, error: false }, simulated: true };
  },
};

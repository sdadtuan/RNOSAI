import type { CarrierId } from '../portal-pos.types';
import { mapCarrierStatus } from '../portal-pos-status.util';

export type CarrierAccount = {
  id: string;
  carrier: CarrierId;
  token: string;
  shop_id: string;
  extra: Record<string, unknown>;
  test_mode: boolean;
};

export type QuoteInput = {
  from_province?: string;
  from_district?: string;
  from_ward?: string;
  to_province: string;
  to_district: string;
  to_ward?: string;
  to_address?: string;
  weight_gram: number;
  value_vnd: number;
  service_code?: string;
};

export type QuoteResult = {
  service_code: string;
  service_name: string;
  fee_vnd: number;
  eta?: string;
};

export type CreateShipmentInput = QuoteInput & {
  client_order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  cod_vnd: number;
  note?: string;
  items: Array<{ name: string; qty: number; price_vnd: number; weight_gram?: number }>;
  service_code: string;
};

export type CreateShipmentResult = {
  tracking_code: string;
  fee_vnd: number;
  label_url: string;
  raw_status: string;
  raw: unknown;
  simulated: boolean;
};

export type CancelResult = { ok: boolean; raw: unknown; simulated: boolean };

export type JsonFetch = (
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text?: () => Promise<string> }>;

export interface CarrierAdapter {
  id: CarrierId;
  quote(account: CarrierAccount, input: QuoteInput, fetchFn?: JsonFetch): Promise<QuoteResult[]>;
  create(
    account: CarrierAccount,
    input: CreateShipmentInput,
    fetchFn?: JsonFetch,
  ): Promise<CreateShipmentResult>;
  cancel(
    account: CarrierAccount,
    trackingCode: string,
    fetchFn?: JsonFetch,
  ): Promise<CancelResult>;
  labelUrl(account: CarrierAccount, trackingCode: string): string;
  mapStatus(raw: string | number): ReturnType<typeof mapCarrierStatus>;
}

/**
 * Live production HTTP is OFF unless PTT_POS_CARRIER_LIVE=1 AND the account is
 * not in test_mode AND a token is present. Default path is simulated/mocked.
 */
export function shouldCallLiveCarrier(account: CarrierAccount): boolean {
  if (account.test_mode) return false;
  if (!(account.token ?? '').trim()) return false;
  return (process.env.PTT_POS_CARRIER_LIVE ?? '').trim() === '1';
}

export async function postJson(
  fetchFn: JsonFetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export function simulatedTracking(carrier: CarrierId, orderCode: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const tail = String(orderCode || 'DH')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(-6)
    .toUpperCase();
  const prefix = carrier === 'ghn' ? 'TEST-GHN' : carrier === 'ghtk' ? 'TEST-GHTK' : 'TEST-VTP';
  return `${prefix}-${tail || 'ORDER'}-${stamp}`;
}

export function defaultFee(input: { weight_gram: number; value_vnd: number }): number {
  const weight = Math.max(1, Math.round(input.weight_gram) || 500);
  const base = 15000 + Math.ceil(weight / 500) * 2500;
  const insurance = input.value_vnd >= 1_000_000 ? 2000 : 0;
  return base + insurance;
}

import { shouldCallLiveCarrier, type CarrierAccount, type JsonFetch } from './carrier-adapter';
import { ghnAdapter, ghnCreateResponse, ghnFeeResponse } from './ghn.adapter';
import { ghtkAdapter, ghtkCreateResponse, ghtkFeeResponse } from './ghtk.adapter';
import { vtpAdapter, vtpCreateResponse, vtpFeeResponse } from './vtp.adapter';
import { getCarrierAdapter } from './index';

function account(carrier: CarrierAccount['carrier'], overrides: Partial<CarrierAccount> = {}): CarrierAccount {
  return {
    id: 'acc-1',
    carrier,
    token: '',
    shop_id: '123',
    extra: {},
    test_mode: true,
    ...overrides,
  };
}

const sampleCreate = {
  from_province: 'Hà Nội',
  from_district: 'Cầu Giấy',
  to_province: 'Hồ Chí Minh',
  to_district: 'Quận 1',
  to_ward: 'Bến Nghé',
  to_address: '12 Nguyễn Huệ',
  weight_gram: 500,
  value_vnd: 350000,
  client_order_code: 'DH-000001',
  customer_name: 'TEST POS Khách',
  customer_phone: '0900000199',
  customer_address: '12 Nguyễn Huệ, Quận 1, HCM',
  cod_vnd: 350000,
  items: [{ name: 'TEST POS Serum', qty: 1, price_vnd: 350000, weight_gram: 500 }],
  service_code: '2',
};

describe('shouldCallLiveCarrier safety', () => {
  const prev = process.env.PTT_POS_CARRIER_LIVE;
  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_POS_CARRIER_LIVE;
    else process.env.PTT_POS_CARRIER_LIVE = prev;
  });

  it('never goes live in test_mode, without a token, or without the LIVE flag', () => {
    delete process.env.PTT_POS_CARRIER_LIVE;
    expect(shouldCallLiveCarrier(account('ghn', { test_mode: true, token: 'secret' }))).toBe(false);
    expect(shouldCallLiveCarrier(account('ghn', { test_mode: false, token: '' }))).toBe(false);
    process.env.PTT_POS_CARRIER_LIVE = '1';
    expect(shouldCallLiveCarrier(account('ghn', { test_mode: true, token: 'secret' }))).toBe(false);
    expect(shouldCallLiveCarrier(account('ghn', { test_mode: false, token: 'secret' }))).toBe(true);
  });
});

describe('simulated create/quote/cancel (default TEST mode, no HTTP)', () => {
  it('GHN returns a TEST-GHN tracking code and documented-shaped raw payload', async () => {
    const quotes = await ghnAdapter.quote(account('ghn'), sampleCreate);
    expect(quotes[0].fee_vnd).toBeGreaterThan(0);
    const created = await ghnAdapter.create(account('ghn'), { ...sampleCreate, service_code: '2' });
    expect(created.simulated).toBe(true);
    expect(created.tracking_code).toMatch(/^TEST-GHN-/);
    expect((created.raw as { code: number; data: { order_code: string } }).code).toBe(200);
    expect((created.raw as { data: { order_code: string } }).data.order_code).toBe(created.tracking_code);
    const cancelled = await ghnAdapter.cancel(account('ghn'), created.tracking_code);
    expect(cancelled.ok).toBe(true);
    expect(cancelled.simulated).toBe(true);
    expect(ghnAdapter.mapStatus('delivered')).toBe('success');
  });

  it('GHTK and Viettel Post simulate documented payloads', async () => {
    const ghtk = await ghtkAdapter.create(account('ghtk'), { ...sampleCreate, service_code: 'road' });
    expect(ghtk.tracking_code).toMatch(/^TEST-GHTK-/);
    expect((ghtk.raw as { success: boolean; order: { label: string } }).success).toBe(true);
    expect(ghtkAdapter.mapStatus(3)).toBe('success');

    const vtp = await vtpAdapter.create(account('vtp'), { ...sampleCreate, service_code: 'VCN' });
    expect(vtp.tracking_code).toMatch(/^TEST-VTP-/);
    expect((vtp.raw as { status: number; data: { ORDER_NUMBER: string } }).data.ORDER_NUMBER).toBe(
      vtp.tracking_code,
    );
    expect(vtpAdapter.mapStatus(501)).toBe('success');
  });
});

describe('adapters with mocked HTTP (documented payloads, LIVE path)', () => {
  const prev = process.env.PTT_POS_CARRIER_LIVE;
  beforeEach(() => {
    process.env.PTT_POS_CARRIER_LIVE = '1';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_POS_CARRIER_LIVE;
    else process.env.PTT_POS_CARRIER_LIVE = prev;
  });

  function mockFetch(payload: unknown): JsonFetch {
    return async (url, init) => {
      expect(url).toMatch(/^https:\/\//);
      expect(init.headers?.Token).toBe('mock-token');
      return { ok: true, status: 200, json: async () => payload };
    };
  }

  const live = (carrier: CarrierAccount['carrier']) =>
    account(carrier, { test_mode: false, token: 'mock-token' });

  it('parses a documented GHN fee and create response', async () => {
    const fee = await ghnAdapter.quote(live('ghn'), sampleCreate, mockFetch(ghnFeeResponse(22000)));
    expect(fee[0].fee_vnd).toBe(22000);
    const created = await ghnAdapter.create(
      live('ghn'),
      sampleCreate,
      mockFetch(ghnCreateResponse('L3ABCD123', 22000)),
    );
    expect(created.simulated).toBe(false);
    expect(created.tracking_code).toBe('L3ABCD123');
    expect(created.fee_vnd).toBe(22000);
    expect(created.label_url).toContain('L3ABCD123');
  });

  it('parses documented GHTK and VTP create responses', async () => {
    const ghtk = await ghtkAdapter.create(
      live('ghtk'),
      sampleCreate,
      mockFetch(ghtkCreateResponse('S1.A1.9999', 18000)),
    );
    expect(ghtk.tracking_code).toBe('S1.A1.9999');
    expect(ghtk.fee_vnd).toBe(18000);

    const vtp = await vtpAdapter.create(
      live('vtp'),
      sampleCreate,
      mockFetch(vtpCreateResponse('1004788999', 19500, 350000)),
    );
    expect(vtp.tracking_code).toBe('1004788999');
    expect(vtp.fee_vnd).toBe(19500);
  });

  it('rejects a failed live create', async () => {
    const fetchFn: JsonFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 401, message: 'Unauthorized' }),
    });
    await expect(ghnAdapter.create(live('ghn'), sampleCreate, fetchFn)).rejects.toThrow('ghn_create_failed');
  });

  it('getCarrierAdapter resolves all three', () => {
    expect(getCarrierAdapter('ghn').id).toBe('ghn');
    expect(getCarrierAdapter('ghtk').id).toBe('ghtk');
    expect(getCarrierAdapter('vtp').id).toBe('vtp');
  });
});

import {
  canTransition,
  customerRisk,
  mapCarrierStatus,
  mapGhnStatus,
  mapGhtkStatus,
  mapVtpStatus,
  stockActionForTransition,
} from './portal-pos-status.util';

describe('order status transitions and stock actions', () => {
  it('reserves on confirm, deducts on ship, releases or restocks on cancel/return', () => {
    expect(stockActionForTransition('new', 'confirmed')).toBe('reserve');
    expect(stockActionForTransition('confirmed', 'packing')).toBeNull();
    expect(stockActionForTransition('packing', 'awaiting_pickup')).toBe('deduct');
    expect(stockActionForTransition('awaiting_pickup', 'shipping')).toBeNull();
    expect(stockActionForTransition('confirmed', 'shipping')).toBe('deduct');
    expect(stockActionForTransition('confirmed', 'cancelled')).toBe('release');
    expect(stockActionForTransition('packing', 'cancelled')).toBe('release');
    expect(stockActionForTransition('awaiting_pickup', 'cancelled')).toBe('restock');
    expect(stockActionForTransition('shipping', 'returned')).toBe('restock');
    expect(stockActionForTransition('success', 'returned')).toBe('restock');
    expect(stockActionForTransition('confirmed', 'returned')).toBe('release');
    expect(stockActionForTransition('new', 'cancelled')).toBeNull();
  });

  it('enforces the allowed path', () => {
    expect(canTransition('new', 'confirmed')).toBe(true);
    expect(canTransition('new', 'shipping')).toBe(false);
    expect(canTransition('success', 'cancelled')).toBe(false);
    expect(canTransition('success', 'returned')).toBe(true);
  });
});

describe('carrier status mapping (documented payloads)', () => {
  it('maps GHN statuses', () => {
    expect(mapGhnStatus('ready_to_pick')).toBe('awaiting_pickup');
    expect(mapGhnStatus('delivering')).toBe('shipping');
    expect(mapGhnStatus('delivered')).toBe('success');
    expect(mapGhnStatus('returned')).toBe('returned');
    expect(mapGhnStatus('cancel')).toBe('cancelled');
    expect(mapGhnStatus('unknown_xyz')).toBeNull();
  });

  it('maps GHTK numeric and Vietnamese statuses', () => {
    expect(mapGhtkStatus(1)).toBe('awaiting_pickup');
    expect(mapGhtkStatus('2')).toBe('shipping');
    expect(mapGhtkStatus(3)).toBe('success');
    expect(mapGhtkStatus(9)).toBe('cancelled');
    expect(mapGhtkStatus(21)).toBe('returned');
    expect(mapGhtkStatus('Đã giao hàng')).toBe('success');
    expect(mapGhtkStatus('Hoàn hàng')).toBe('returned');
  });

  it('maps Viettel Post status codes', () => {
    expect(mapVtpStatus(100)).toBe('awaiting_pickup');
    expect(mapVtpStatus('200')).toBe('shipping');
    expect(mapVtpStatus(501)).toBe('success');
    expect(mapVtpStatus(504)).toBe('returned');
    expect(mapVtpStatus(-100)).toBe('cancelled');
  });

  it('dispatches by carrier id', () => {
    expect(mapCarrierStatus('ghn', 'picked')).toBe('shipping');
    expect(mapCarrierStatus('ghtk', 5)).toBe('success');
    expect(mapCarrierStatus('vtp', 503)).toBe('returned');
  });
});

describe('customerRisk', () => {
  it('blocks blacklisted customers and warns on high return rate', () => {
    expect(customerRisk({ success: 5, returned: 0, blacklist: true }).level).toBe('block');
    expect(customerRisk({ success: 1, returned: 2 }).level).toBe('warn');
    expect(customerRisk({ success: 7, returned: 3 }).level).toBe('warn');
    expect(customerRisk({ success: 8, returned: 1 }).level).toBe('ok');
    expect(customerRisk({ success: 0, returned: 0 }).level).toBe('ok');
  });
});

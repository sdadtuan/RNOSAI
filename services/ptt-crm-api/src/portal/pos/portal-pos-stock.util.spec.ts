import { applyStockMovement, availableStock, isLowStock, StockError } from './portal-pos-stock.util';

describe('applyStockMovement', () => {
  const start = { on_hand: 10, reserved: 2 };

  it('imports and restocks increase on_hand', () => {
    expect(applyStockMovement(start, 'import', 5)).toEqual({ on_hand: 15, reserved: 2 });
    expect(applyStockMovement(start, 'restock', 3)).toEqual({ on_hand: 13, reserved: 2 });
  });

  it('exports only from available units', () => {
    expect(applyStockMovement(start, 'export', 8)).toEqual({ on_hand: 2, reserved: 2 });
    expect(() => applyStockMovement(start, 'export', 9)).toThrow(StockError);
  });

  it('reserves from available and releases reserved', () => {
    expect(applyStockMovement(start, 'reserve', 5)).toEqual({ on_hand: 10, reserved: 7 });
    expect(() => applyStockMovement(start, 'reserve', 9)).toThrow('insufficient_stock');
    expect(applyStockMovement({ on_hand: 10, reserved: 4 }, 'release', 3)).toEqual({
      on_hand: 10,
      reserved: 1,
    });
    expect(applyStockMovement({ on_hand: 10, reserved: 2 }, 'release', 9)).toEqual({
      on_hand: 10,
      reserved: 0,
    });
  });

  it('deducts on ship from reserved then on_hand', () => {
    expect(applyStockMovement({ on_hand: 10, reserved: 3 }, 'deduct', 3)).toEqual({
      on_hand: 7,
      reserved: 0,
    });
    expect(applyStockMovement({ on_hand: 10, reserved: 1 }, 'deduct', 3)).toEqual({
      on_hand: 7,
      reserved: 0,
    });
    expect(() => applyStockMovement({ on_hand: 2, reserved: 0 }, 'deduct', 3)).toThrow(
      'insufficient_stock',
    );
  });

  it('adjust sets absolute on_hand and clips reserved', () => {
    expect(applyStockMovement({ on_hand: 10, reserved: 4 }, 'adjust', 3)).toEqual({
      on_hand: 3,
      reserved: 3,
    });
  });

  it('rejects negative qty', () => {
    expect(() => applyStockMovement(start, 'import', -1)).toThrow('invalid_qty');
  });
});

describe('available + low stock', () => {
  it('computes available and low-stock badge', () => {
    const s = { on_hand: 8, reserved: 5 };
    expect(availableStock(s)).toBe(3);
    expect(isLowStock(s, 5)).toBe(true);
    expect(isLowStock(s, 2)).toBe(false);
    expect(isLowStock({ on_hand: 0, reserved: 0 }, 5)).toBe(true);
  });
});

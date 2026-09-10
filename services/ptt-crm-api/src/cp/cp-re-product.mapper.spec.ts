import {
  formatPriceFromVnd,
  mapReProductToBatchRow,
  mapReProductsToBatchRows,
} from './cp-re-product.mapper';

const PROJECT = {
  id: 7,
  name: 'The Peak',
  district: 'Quận 7',
  city: 'TP.HCM',
  location_address: 'Nguyễn Văn Linh',
};

describe('cp-re-product.mapper', () => {
  it('formats price in ty for large values', () => {
    expect(formatPriceFromVnd(3_200_000_000)).toBe('từ 3.2 tỷ');
    expect(formatPriceFromVnd(2_000_000_000)).toBe('từ 2 tỷ');
  });

  it('maps available product to batch row vars', () => {
    const mapped = mapReProductToBatchRow(
      {
        id: 101,
        unit_code: 'A-12-05',
        net_price_vnd: 3_500_000_000,
        status: 'available',
      },
      PROJECT,
      { hotline: '19001234', cta: 'Đăng ký' },
    );
    expect(mapped.error).toBeUndefined();
    expect(mapped.row).toMatchObject({
      project_name: 'The Peak · A-12-05',
      price_from: 'từ 3.5 tỷ',
      location: 'Quận 7, TP.HCM',
      hotline: '19001234',
      cta: 'Đăng ký',
    });
  });

  it('skips sold products unless includeSold flag set', () => {
    const batch = mapReProductsToBatchRows(
      [
        { id: 1, unit_code: 'A1', net_price_vnd: 2_000_000_000, status: 'available' },
        { id: 2, unit_code: 'B1', net_price_vnd: 2_500_000_000, status: 'sold' },
      ],
      PROJECT,
    );
    expect(batch.rows).toHaveLength(1);
    expect(batch.skipped).toEqual([{ id: 2, reason: 'skip_status_sold' }]);
  });
});

import { csvMoney, parseCsv } from './portal-pos-csv.util';

describe('parseCsv', () => {
  it('parses Vietnamese headers and quoted commas', () => {
    const { rows } = parseCsv(
      'Tên,SKU,Giá,Tồn kho,Màu\n"Serum, 30ml",SR-01,"350,000",12,Hồng\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Serum, 30ml');
    expect(rows[0].sku).toBe('SR-01');
    expect(csvMoney(rows[0].price)).toBe(350000);
    expect(rows[0].stock).toBe('12');
    expect(rows[0].color).toBe('Hồng');
  });

  it('maps COD statement headers', () => {
    const { rows } = parseCsv('Mã vận đơn,Tiền COD,Phí,Thực nhận\nTEST-GHN-1,200000,22000,178000\n');
    expect(rows[0].tracking_code).toBe('TEST-GHN-1');
    expect(csvMoney(rows[0].actual_cod)).toBe(200000);
    expect(csvMoney(rows[0].fee)).toBe(22000);
    expect(csvMoney(rows[0].payout)).toBe(178000);
  });
});

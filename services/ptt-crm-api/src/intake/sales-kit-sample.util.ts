import ExcelJS from 'exceljs';

export const SALES_KIT_SAMPLE_QA_ROWS: Array<[string, string]> = [
  ['KH nói đắt', 'Neo gói TC 3 tháng, không giảm dưới band'],
  ['KH tự làm SEO được', 'SEO cần đo 90 ngày; không so sánh tuần đầu với agency cũ'],
  ['KH đang có agency', 'Hỏi KPI họ đang miss; không đả kích agency cũ'],
  ['KH muốn rank trong 1 tháng', 'Neo 3 tháng kỹ thuật; không cam kết rank tuần'],
  ['KH hỏi case BĐS', 'Chỉ nêu case đã duyệt trong kho; không bịa tên khách'],
];

export async function buildSalesKitSampleXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('qa');
  sh.addRow(['cau_hoi', 'cau_tra_loi']);
  for (const row of SALES_KIT_SAMPLE_QA_ROWS) {
    sh.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

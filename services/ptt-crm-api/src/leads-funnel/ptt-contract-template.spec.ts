import JSZip from 'jszip';
import { hourlyFromPosition, assembleQuoteSheet, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import {
  fillPttMarketingContract,
  loadPttContractTemplate,
  formatPttContractNo,
  brandCodeFromName,
} from './ptt-contract-template';
import { renderLeadContractDocx } from './lead-quote-docx';

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('missing word/document.xml');
  return file.async('string');
}

function xmlText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

const staff: QuoteSheetStaff[] = [
  {
    id: 7,
    name: 'An',
    position_code: 'AE',
    position_name: 'Account Executive',
    monthly_salary_vnd: 15_000_000,
    hours_per_month: 176,
    hourly_vnd: hourlyFromPosition(15_000_000, 176),
  },
];

const item: QuoteSheetItem = {
  code: 'WEB-01-01',
  service_code: 'WEB',
  service_name: 'Website',
  phase_code: 'K',
  phase_name: 'Khởi động',
  task: 'Tiếp nhận handover',
  subtask: 'Đọc brief và chốt phạm vi.',
  role_code: 'am',
  est_hours: 2,
  qty: 1,
  unit: 'times',
  billable: true,
  client_only: false,
};

describe('PTT marketing contract template', () => {
  it('builds a Tuấn-format contract number from the brand', () => {
    expect(brandCodeFromName('Công ty UAT Handoff')).toBe('UATH');
    expect(brandCodeFromName('UAT Handoff 2026-11-12 13:49:14')).toBe('UATH');
    expect(formatPttContractNo(900000115, 'Công ty UAT Handoff', 2026)).toBe(
      '115 / UATH-PTT / HĐDV / 2026',
    );
  });

  it('clones anh Tuấn\'s template, fills CRM fields, and keeps legal text and Bên B', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: item.code, staff_id: 7, hours: 2, included: true }],
      promoPercent: 0,
      vatPercent: 8,
    });
    const docx = await renderLeadContractDocx(view, {
      client: 'Công ty Lan',
      contactName: 'Nguyễn Văn A',
      address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
      phone: '0901234567',
      email: 'lan@example.com',
      taxId: '',
      brand: 'Lan',
      amName: 'Trần Thị AM',
      contractNo: '042 / LAN-PTT / HĐDV / 2026',
      statusLabel: 'Bản gửi GĐKD',
      createdLabel: '13/11/2026',
      signedLabel: '',
      amountVnd: view.grand_total_vnd,
      leadId: 42,
    });
    expect(docx.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');
    const zip = await JSZip.loadAsync(docx);
    expect(zip.file('word/fonts/Caudex-regular.ttf')).toBeTruthy();
    expect(zip.file('word/fonts/Arimo-regular.ttf')).toBeTruthy();
    const xml = await documentXml(docx);
    expect(xml).not.toContain('%/w:t>');
    const text = xmlText(xml);

    expect(text).toContain('HỢP ĐỒNG DỊCH VỤ MARKETING');
    expect(text).toContain('ĐIỀU 1. ĐỊNH NGHĨA VÀ GIẢI THÍCH');
    expect(text).toContain('ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN');
    expect(text).toContain('ĐIỀU 13. ĐIỀU KHOẢN CHUNG');
    expect(text).toContain('50% giá trị Giai đoạn tương ứng');
    expect(text).toContain('30% giá trị Giai đoạn tương ứng');
    expect(text).toContain('20% giá trị Giai đoạn tương ứng');
    expect(text).toContain('Công Ty TNHH Giải Pháp Quảng Cáo PTT');
    expect(text).toContain('0319378318');
    expect(text).toContain('Ông Trương Quốc Tuấn');
    expect(text).toContain('info@pttads.vn');
    expect(text).toContain('587978');
    expect(text).toContain('Hợp đồng gồm 05 trang và 02 (hai) Phụ lục');

    expect(text).toContain('042 / LAN-PTT / HĐDV / 2026');
    expect(text).toContain('Công ty Lan');
    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain('12 Nguyễn Huệ, Quận 1, TP.HCM');
    expect(text).toContain('0901234567');
    expect(text).toContain('lan@example.com');
    expect(text).toContain('Tiếp nhận handover');
    expect(text).toContain('Đọc brief và chốt phạm vi.');
    expect(text).toContain('Trần Thị AM');
    expect(text).toContain('Không triển khai');
    expect(text).toContain('ngày 13 tháng 11 năm 2026');

    expect(text).not.toContain('360 Auto Detailing');
    expect(text).not.toContain('Huỳnh Ngọc Tuyết Nhi');
    expect(text).not.toContain('8606482821-001');
    expect(text).not.toContain('hungngo12436@gmail.com');
    expect(text).not.toContain('068 / 360AD-PTT');
    expect(text).not.toContain('Website Landing Page');
    expect(text).not.toContain('quay/chụp tại điểm kinh doanh');
    expect(text).not.toContain('HỢP ĐỒNG CUNG CẤP DỊCH VỤ');
    expect(text).not.toContain('An');
    expect(text).not.toContain('Account Executive');

    const original = await documentXml(loadPttContractTemplate());
    expect(original).toContain('HỢP ĐỒNG DỊCH VỤ MARKETING');
    expect(original).toContain('360 Auto Detailing');
  });

  it('leaves Bên B and Điều 4.2 legal wording untouched when filling', async () => {
    const template = loadPttContractTemplate();
    const original = xmlText(await documentXml(template));
    const legal42 =
      'Lịch thanh toán dưới đây áp dụng riêng cho từng Giai đoạn, Giai đoạn 1 tính từ ngày ký Hợp đồng.';
    const benB = 'Công Ty TNHH Giải Pháp Quảng Cáo PTT';
    expect(original).toContain(legal42);
    expect(original).toContain(benB);

    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: item.code, staff_id: 7, hours: 2, included: true }],
      promoPercent: 0,
      vatPercent: 8,
    });
    const filled = await fillPttMarketingContract(
      template,
      (
        await import('./ptt-contract-template')
      ).buildPttContractFillInput(view, {
        client: 'Công ty Lan',
        contractNo: '001 / LAN-PTT / HĐDV / 2026',
        createdLabel: '13/11/2026',
        amountVnd: view.grand_total_vnd,
      }),
    );
    const text = xmlText(await documentXml(filled));
    expect(text).toContain(legal42);
    expect(text).toContain(benB);
    expect(text).toContain('0909 965 286');
  });
});

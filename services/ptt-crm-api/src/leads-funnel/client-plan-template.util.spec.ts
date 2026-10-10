import JSZip from 'jszip';
import { isSampleClient, renderClientPlanFromTemplate } from './client-plan-template.util';

const other = {
  client: 'Quý Nguyễn Studio',
  phone: '0900000000',
  address: 'Quận 1',
  website: 'https://studio.example/',
  fanpage: 'https://facebook.com/quy.studio',
  niche: 'Ảnh cưới',
  need: 'ít lịch',
  service: 'SEO tổng thể',
  usp: 'Concept riêng',
  goal: 'Tăng lịch chụp',
  channels: 'Facebook',
  message: 'Concept riêng',
  media: 'Facebook',
  northStar: 'Tăng lịch chụp',
};

async function slideText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name));
  const parts = await Promise.all(names.map((name) => zip.file(name)!.async('string')));
  return parts.join('\n');
}

describe('renderClientPlanFromTemplate', () => {
  it('recognises the sample spa', () => {
    expect(isSampleClient({ client: 'Massage Tĩnh Viên', website: '', fanpage: '' })).toBe(true);
    expect(isSampleClient(other)).toBe(false);
  });

  it('fills another client and drops the sample spa facts', async () => {
    const buf = await renderClientPlanFromTemplate(other);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const text = await slideText(buf);
    expect(text).toContain('Quý Nguyễn Studio');
    expect(text).toContain('0900000000');
    expect(text).not.toContain('Tĩnh Viên');
    expect(text).not.toContain('0927.717.717');
    expect(text).not.toContain('149k');
    expect(text).not.toContain('Nguyệt Lâu');
    expect(text).toContain('Tăng lịch chụp');
  });

  it('keeps the researched prices for Massage Tĩnh Viên', async () => {
    const buf = await renderClientPlanFromTemplate({
      client: 'Massage Tĩnh Viên',
      phone: '0927.717.717',
      website: 'https://massagetinhvien.com/',
      fanpage: 'https://www.facebook.com/massagetinhvien',
      address: '151 Hòa Hưng, Phường Hòa Hưng, TP.HCM',
    });
    const text = await slideText(buf);
    expect(text).toContain('149k');
    expect(text).toContain('Massage Tĩnh Viên');
    expect(text).not.toContain('video tốt nhất');
  });
});

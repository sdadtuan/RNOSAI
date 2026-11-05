import { qaAnswerFromBody, scoreSalesKitChunks } from './sales-kit-retrieve.util';

describe('sales-kit-retrieve.util', () => {
  it('boosts session chunk on tie and drops draft/needs_ocr', () => {
    const hits = scoreSalesKitChunks({
      query: 'đắt',
      rows: [
        {
          body: 'Q: KH nói đắt\nA: Neo gói org',
          title: 'đắt',
          file_id: '1',
          file_name: 'org.xlsx',
          folder_path: 'dich-vu-seo-tong-the/qa',
          kind: 'qa',
          is_session: false,
          parse_status: 'ready',
        },
        {
          body: 'Q: KH nói đắt\nA: Neo gói session',
          title: 'đắt',
          file_id: '2',
          file_name: 'bag.xlsx',
          folder_path: 'session/5/12',
          kind: 'qa',
          is_session: true,
          parse_status: 'ready',
        },
        {
          body: 'Q: đắt\nA: draft',
          title: 'đắt',
          file_id: '3',
          file_name: 'draft.xlsx',
          folder_path: 'dich-vu-seo-tong-the/qa',
          kind: 'qa',
          is_session: false,
          parse_status: 'pending',
        },
      ],
    });
    expect(hits[0].file_id).toBe('2');
    expect(hits.some((h) => h.file_id === '3')).toBe(false);
  });

  it('qaAnswerFromBody returns A line', () => {
    expect(qaAnswerFromBody('Q: x\nA: Neo gói TC')).toBe('Neo gói TC');
  });

  it('filters by kindHint so pricing_band does not return qa', () => {
    const hits = scoreSalesKitChunks({
      query: 'pricing dich-vu-seo-tong-the',
      kindHint: 'pricing_band',
      rows: [
        {
          body: 'Q: đắt\nA: Neo gói',
          title: 'đắt',
          file_id: '1',
          file_name: 'qa.xlsx',
          folder_path: 'dich-vu-seo-tong-the/qa',
          kind: 'qa',
          is_session: false,
          parse_status: 'ready',
        },
        {
          body: 'Gói SEO TC: 15000000–25000000 VND',
          title: 'band',
          file_id: '2',
          file_name: 'gia.xlsx',
          folder_path: 'dich-vu-seo-tong-the/pricing',
          kind: 'pricing',
          is_session: false,
          parse_status: 'ready',
        },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.file_id).toBe('2');
  });
});

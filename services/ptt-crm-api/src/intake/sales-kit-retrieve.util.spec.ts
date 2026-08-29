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
});

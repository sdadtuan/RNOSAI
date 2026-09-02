import { parseMentions, parseTicketCodes } from './csd-chat-search.util';

describe('csd-chat-search.util', () => {
  it('parses @staffId mentions', () => {
    expect(parseMentions('cc @8 và @12')).toEqual([8, 12]);
  });

  it('parses #PTT-YYYY-NNNNNN ticket codes', () => {
    expect(parseTicketCodes('xem #PTT-2026-000099')).toEqual(['PTT-2026-000099']);
  });

  it('dedupes mentions and ignores self-like fragments', () => {
    expect(parseMentions('@8 @8 email@x.com @0 @12')).toEqual([8, 12]);
  });

  it('ignores incomplete ticket hashes', () => {
    expect(parseTicketCodes('#PTT-26-1 #ticket')).toEqual([]);
  });
});

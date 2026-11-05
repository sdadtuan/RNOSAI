import { parseByteRange } from './cp-asset-byte-range.util';

describe('parseByteRange', () => {
  it('returns the full file when Range is missing', () => {
    expect(parseByteRange(undefined, 8215)).toEqual({
      start: 0,
      end: 8214,
      status: 200,
    });
  });

  it('parses Safari first-byte and suffix ranges', () => {
    expect(parseByteRange('bytes=0-1', 8215)).toEqual({
      start: 0,
      end: 1,
      status: 206,
    });
    expect(parseByteRange('bytes=0-', 8215)).toEqual({
      start: 0,
      end: 8214,
      status: 206,
    });
    expect(parseByteRange('bytes=-100', 8215)).toEqual({
      start: 8115,
      end: 8214,
      status: 206,
    });
  });

  it('rejects unsatisfiable ranges', () => {
    expect(parseByteRange('bytes=9000-9001', 8215)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=abc', 8215)).toBe('unsatisfiable');
  });
});

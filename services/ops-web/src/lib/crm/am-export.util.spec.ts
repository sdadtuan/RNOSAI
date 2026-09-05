import { describe, expect, it } from 'vitest';
import { amExportTooLargeCopy, escapeAmCsvCell } from './am-export.util';

describe('amExportTooLargeCopy', () => {
  it('returns Vietnamese copy for export_too_large', () => {
    expect(amExportTooLargeCopy('export_too_large')).toBe(
      'Export quá 10.000 dòng — thu hẹp bộ lọc.',
    );
  });

  it('returns the code unchanged otherwise', () => {
    expect(amExportTooLargeCopy('other')).toBe('other');
  });
});

describe('escapeAmCsvCell', () => {
  it('quotes commas, quotes, and newlines', () => {
    expect(escapeAmCsvCell('a,b')).toBe('"a,b"');
    expect(escapeAmCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeAmCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeAmCsvCell('plain')).toBe('plain');
  });
});

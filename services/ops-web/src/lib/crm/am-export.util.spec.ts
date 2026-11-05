import { describe, expect, it } from 'vitest';
import {
  amExportCsvFromResponse,
  amExportDownloadCsv,
  amExportTooLargeCopy,
  escapeAmCsvCell,
} from './am-export.util';

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

describe('amExportCsvFromResponse', () => {
  it('returns the body when Content-Type is text/csv', () => {
    const csv = 'agency_client_id,code\nid-1,AP01\n';
    expect(amExportCsvFromResponse('text/csv; charset=utf-8', csv)).toBe(csv);
  });

  it('reads .csv from a JSON body', () => {
    expect(amExportCsvFromResponse('application/json', '{"csv":"a,b\\n1,2\\n","rows":1}')).toBe(
      'a,b\n1,2\n',
    );
  });
});

describe('amExportDownloadCsv', () => {
  it('accepts a raw csv string or { csv }', () => {
    expect(amExportDownloadCsv('id,name\n')).toBe('id,name\n');
    expect(amExportDownloadCsv({ csv: 'id,name\n' })).toBe('id,name\n');
  });
});

import { decodeSolutionDataUrl, parseSolutionStoredFiles, repairSolutionFileNames } from './solution-file-bytes.util';

describe('solution file bytes', () => {
  it('decodes base64 and uri data urls', () => {
    const html = Buffer.from('<p>PTT</p>', 'utf8').toString('base64');
    expect(decodeSolutionDataUrl(`data:text/html;base64,${html}`)?.toString('utf8')).toBe('<p>PTT</p>');
    expect(decodeSolutionDataUrl('data:text/html;charset=utf-8,%3Cp%3Eok%3C%2Fp%3E')?.toString('utf8')).toBe('<p>ok</p>');
    expect(decodeSolutionDataUrl('not-a-data-url')).toBeNull();
  });

  it('reads files packed as a JSON string', () => {
    const files = parseSolutionStoredFiles({
      mkt_files: JSON.stringify([{ id: 'a', name: 'brief.pdf', mime: 'application/pdf', data_url: 'data:application/pdf;base64,QQ==' }]),
    });
    expect(files).toEqual([
      { id: 'a', name: 'brief.pdf', mime: 'application/pdf', data_url: 'data:application/pdf;base64,QQ==', size: undefined },
    ]);
  });

  it('repairs a UTF-8 Solution name that arrived as Latin-1', () => {
    const original = 'Báo giá Solution.pdf';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');
    const raw = JSON.stringify([{ id: 'a', name: mojibake, mime: 'application/pdf', data_url: 'data:application/pdf;base64,QQ==' }]);
    expect(parseSolutionStoredFiles({ mkt_files: raw })[0]?.name).toBe(original);
    const repaired = repairSolutionFileNames(raw);
    expect(typeof repaired).toBe('string');
    expect(String(repaired)).toContain(original);
    expect(String(repaired)).toContain('"id":"a"');
  });
});

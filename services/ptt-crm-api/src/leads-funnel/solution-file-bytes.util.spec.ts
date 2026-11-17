import { decodeSolutionDataUrl, parseSolutionStoredFiles } from './solution-file-bytes.util';

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
});

import { describe, expect, it } from 'vitest';
import { formatAttachmentMeta, formatFileSize, readSolutionAttachments } from './solution-file-display';

describe('formatFileSize', () => {
  it('uses KB/MB labels', () => {
    expect(formatFileSize(24)).toBe('24 B');
    expect(formatFileSize(24 * 1024)).toBe('24 KB');
  });
});

describe('readSolutionAttachments and meta', () => {
  it('keeps uploader, time without seconds, and size', () => {
    const files = readSolutionAttachments({
      strategy_framework: {
        mkt_files: JSON.stringify([
          {
            id: '1',
            name: 'Solution Test.pdf',
            mime: 'application/pdf',
            data_url: 'data:application/pdf;base64,AAAA',
            size: 24576,
            uploaded_by: 'Admin Local',
            uploaded_at: '2026-11-14T12:09:31.000Z',
          },
        ]),
      },
    });
    expect(files).toHaveLength(1);
    const meta = formatAttachmentMeta(files[0]);
    expect(meta).toContain('24 KB');
    expect(meta).toContain('Admin Local');
    expect(meta).toMatch(/14\/11\/2026/);
    expect(meta).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

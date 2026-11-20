import { describe, expect, it } from 'vitest';
import { decodeUploadedFileName, formatAttachmentMeta, formatFileSize, readSolutionAttachments } from './solution-file-display';

describe('formatFileSize', () => {
  it('uses KB/MB labels', () => {
    expect(formatFileSize(24)).toBe('24 B');
    expect(formatFileSize(24 * 1024)).toBe('24 KB');
  });
});

describe('readSolutionAttachments and meta', () => {
  it('hides legacy AI exports and keeps a manual upload with the same name', () => {
    const name = 'Solution PTT Ads - Công ty Seed 685.pdf';
    const data_url = 'data:application/pdf;base64,AAAA';
    const files = readSolutionAttachments({
      strategy_framework: {
        mkt_files: JSON.stringify([
          { id: 'solution-ptt-pdf-920685', name, data_url },
          { id: 'solution-ptt-docx-920685', name: 'Solution.docx', data_url },
          { id: 'upload-1', name, data_url },
        ]),
      },
    });
    expect(files.map((file) => file.id)).toEqual(['upload-1']);
  });

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

  it('repairs a Latin-1 upload name when showing the file', () => {
    const original = 'Báo giá Solution.pdf';
    const bytes = new TextEncoder().encode(original);
    const mojibake = String.fromCharCode(...bytes);
    expect(decodeUploadedFileName(mojibake)).toBe(original);
    expect(decodeUploadedFileName(original)).toBe(original);
    const files = readSolutionAttachments({
      strategy_framework: {
        mkt_files: JSON.stringify([{ id: '1', name: mojibake, mime: 'application/pdf', data_url: 'data:application/pdf;base64,QQ==' }]),
      },
    });
    expect(files[0]?.name).toBe(original);
    expect(files[0]?.id).toBe('1');
  });
});

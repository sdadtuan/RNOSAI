import { describe, expect, it } from 'vitest';
import { csdChatFileKind, formatCsdChatFileBytes } from '@/lib/crm/csd-chat-file-local';

describe('csd-chat-file-local helpers', () => {
  it('formats byte sizes for chat file chips', () => {
    expect(formatCsdChatFileBytes(768)).toBe('768 B');
    expect(formatCsdChatFileBytes(3_940_000)).toBe('3.76 MB');
  });

  it('detects common attachment kinds from filename', () => {
    expect(csdChatFileKind('brief.pdf')).toBe('pdf');
    expect(csdChatFileKind('plan.docx')).toBe('doc');
    expect(csdChatFileKind('sheet.xlsx')).toBe('xls');
  });
});

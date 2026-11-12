import { describe, expect, it } from 'vitest';
import { SOLUTION_FILE_MAX_TOTAL_BYTES, solutionFileAddError, solutionFileTotalBytes } from './solution-file-limit';

describe('solution-file-limit', () => {
  it('allows files that stay under 15MB total and 5 files', () => {
    expect(solutionFileAddError(0, 14 * 1024 * 1024, 0)).toBeNull();
    expect(solutionFileAddError(10 * 1024 * 1024, 5 * 1024 * 1024, 2)).toBeNull();
  });

  it('rejects a sixth file and a total over 15MB', () => {
    expect(solutionFileAddError(0, 1024, 5)).toBe('Tối đa 5 file');
    expect(solutionFileAddError(10 * 1024 * 1024, 6 * 1024 * 1024, 1)).toBe(
      'Tổng dung lượng tệp vượt quá 15MB',
    );
  });

  it('sums sizes', () => {
    expect(solutionFileTotalBytes([100, 200, 15 * 1024 * 1024])).toBe(100 + 200 + SOLUTION_FILE_MAX_TOTAL_BYTES);
  });
});
